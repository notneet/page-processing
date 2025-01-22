import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { freemem, totalmem } from 'os';
import { Browser, chromium, Page } from 'playwright';
import { BrowserPage, PageState, ScrollOptions } from './types/browser.type';

@Injectable()
export class BrowserService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser;
  private pages: Map<string, BrowserPage> = new Map();
  private readonly RAM_THRESHOLD = 80; // 80% RAM usage threshold
  private monitoringInterval: ReturnType<typeof setInterval>;
  private readonly blockedResources = ['stylesheet', 'image', 'media', 'font'];

  constructor(private readonly configService: ConfigService) {
    this.startResourceMonitoring();
  }

  private get browserHeadless() {
    return this.configService.get<string>('HEADLESS', 'true') === 'true';
  }

  private get ignoreResouces() {
    return (
      this.configService.get<string>('IGNORE_RESOURCES', 'false') === 'true'
    );
  }

  async onModuleInit() {
    await this.initBrowser();
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  private async initBrowser() {
    this.browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
      headless: this.browserHeadless,
    });
  }

  private startResourceMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      const ramUsage = this.getRAMUsage();

      if (ramUsage >= this.RAM_THRESHOLD) {
        this.logger.debug(`High RAM usage detected: ${ramUsage}%`);
        await this.handleHighRAMUsage();
      }

      // Clean up zombie processes
      await this.cleanupZombiePages();
    }, 5000); // Check every 5 seconds
  }

  private getRAMUsage(): number {
    const totalMem = totalmem();
    const freeMem = freemem();
    return ((totalMem - freeMem) / totalMem) * 100;
  }

  private async handleHighRAMUsage() {
    // Close all DONE pages
    for (const [id, browserPage] of this.pages.entries()) {
      if (browserPage.state === PageState.DONE) {
        await this.closePage(id);
      }
    }

    // If RAM is still high, restart the browser
    if (this.getRAMUsage() >= this.RAM_THRESHOLD) {
      await this.restartBrowser();
    }
  }

  private async restartBrowser() {
    this.logger.debug('Restarting browser due to high RAM usage');
    await this.cleanup();
    await this.initBrowser();
  }

  private async cleanupZombiePages() {
    let closedPages: number = 0;
    const now = new Date();
    const ZOMBIE_THRESHOLD = 5 * 1000; // 5 seconds

    for (const [id, browserPage] of this.pages.entries()) {
      const timeDiff = now.getTime() - browserPage.lastUsed.getTime();

      if (
        timeDiff > ZOMBIE_THRESHOLD &&
        browserPage.state !== PageState.IN_USE
      ) {
        await this.closePage(id);
        closedPages++;
      }
    }
    this.logger.debug(`Closed ${closedPages} zombie pages`);
  }

  async createPage(): Promise<string> {
    const page = await this.browser.newPage();
    const id = Math.random().toString(36).substring(7);

    if (this.ignoreResouces) {
      await this.interceptResouce(page);
    }

    this.pages.set(id, {
      page,
      state: PageState.IDLE,
      lastUsed: new Date(),
    });

    return id;
  }

  async getPage(id: string): Promise<Page | null> {
    const browserPage = this.pages.get(id);
    if (!browserPage) return null;

    browserPage.state = PageState.IN_USE;
    browserPage.lastUsed = new Date();
    return browserPage.page;
  }

  async releasePage(id: string) {
    const browserPage = this.pages.get(id);
    if (browserPage) {
      browserPage.state = PageState.DONE;
      browserPage.lastUsed = new Date();
    }
  }

  async interceptResouce(page: Page) {
    // intercept incoming request
    await page.route('**/*', (route) => {
      const request = route.request();
      const resouceType = route.request().resourceType();

      if (
        this.blockedResources.includes(resouceType) &&
        request.url().startsWith('http')
      ) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  async closePage(id: string) {
    const browserPage = this.pages.get(id);
    if (browserPage) {
      await browserPage.page.close();
      this.pages.delete(id);
    }
  }

  private async cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    for (const [id, browserPage] of this.pages.entries()) {
      await this.closePage(id);
    }

    if (this.browser) {
      await this.browser.close();
    }
  }

  getPageStats() {
    const stats = {
      total: this.pages.size,
      idle: 0,
      inUse: 0,
      done: 0,
    };

    for (const browserPage of this.pages.values()) {
      switch (browserPage.state) {
        case PageState.IDLE:
          stats.idle++;
          break;
        case PageState.IN_USE:
          stats.inUse++;
          break;
        case PageState.DONE:
          stats.done++;
          break;
      }
    }

    return stats;
  }

  async autoScroll(page: Page, options: ScrollOptions = {}) {
    const {
      scrollDelay = 1000,
      maxScrolls = 50,
      scrollStep = 800,
      bottomThreshold = 100,
      waitForSelector,
      scrollBehavior = 'smooth',
    } = options;

    let reachedBottom = false;
    let previousHeight = 0;
    let scrollAttempts = 0;

    while (!reachedBottom && scrollAttempts < maxScrolls) {
      const currentHeight = await page.evaluate(
        async ({ scrollStep, scrollBehavior }) => {
          const previousScrollPos = window.scrollY;
          window.scrollBy({
            top: scrollStep,
            behavior: scrollBehavior,
          });

          // Wait for scroll to complete
          await new Promise((resolve) => setTimeout(resolve, 100));

          return {
            documentHeight: document.documentElement.scrollHeight,
            scrollPosition: window.scrollY,
            previousScrollPos,
            viewportHeight: window.innerHeight,
          };
        },
        { scrollStep, scrollBehavior },
      );

      // If we haven't scrolled or we're at the bottom
      if (
        currentHeight.scrollPosition === currentHeight.previousScrollPos ||
        currentHeight.scrollPosition +
          currentHeight.viewportHeight +
          bottomThreshold >=
          currentHeight.documentHeight
      ) {
        reachedBottom = true;
      }

      // If content height changed, we might have dynamic loading
      if (currentHeight.documentHeight !== previousHeight) {
        reachedBottom = false;
        previousHeight = currentHeight.documentHeight;
      }

      if (waitForSelector) {
        try {
          await page.waitForSelector(waitForSelector, { timeout: scrollDelay });
        } catch (error) {
          // Continue if selector not found
        }
      }

      await page.waitForTimeout(scrollDelay);
      scrollAttempts++;
    }

    return {
      reachedBottom,
      scrollAttempts,
      totalHeight: previousHeight,
    };
  }

  async scrollAndClick(
    page: Page,
    selector: string,
    options: ScrollOptions & {
      clickOptions?: {
        position?: { x: number; y: number };
        force?: boolean;
        delay?: number;
        button?: 'left' | 'right' | 'middle';
        clickCount?: number;
        closeNewPage?: boolean;
        newPageTimeout?: number;
      };
    } = {},
  ) {
    try {
      // First try to find the element
      const element = page.locator(selector).first();

      // Get element's position
      const boundingBox = await element.boundingBox();
      if (!boundingBox) {
        throw new Error('Could not determine element position');
      }

      // Scroll element into view
      await page.evaluate((selector) => {
        const element = document.evaluate(
          selector,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue as HTMLElement;

        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
        }
      }, selector);

      // Wait for scroll to complete
      await page.waitForTimeout(options.scrollDelay || 1000);

      // Check if element is now visible
      await element.waitFor({
        state: 'visible',
        timeout: 5000,
      });

      if (options.clickOptions?.closeNewPage) {
        // Listen for new pages before clicking
        const newPagePromise = page.context().waitForEvent('page', {
          timeout: options.clickOptions?.newPageTimeout || 5000,
        });

        // Perform the click
        await element.click({
          position: options.clickOptions?.position,
          force: options.clickOptions?.force || false,
          delay: options.clickOptions?.delay,
          button: options.clickOptions?.button || 'left',
          clickCount: options.clickOptions?.clickCount || 1,
          timeout: 5000,
        });

        try {
          // Wait for and close the new page
          const newPage = await newPagePromise;
          await newPage.close();
        } catch (error) {
          console.log('No new page opened or timeout reached');
        }
      } else {
        // Normal click without new page handling
        await element.click({
          position: options.clickOptions?.position,
          force: options.clickOptions?.force || false,
          delay: options.clickOptions?.delay,
          button: options.clickOptions?.button || 'left',
          clickCount: options.clickOptions?.clickCount || 1,
          timeout: 5000,
        });
      }

      return true;
    } catch (error) {
      console.error('Error in scrollAndClick:', error);
      throw error;
    }
  }
}
