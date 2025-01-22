import { BrowserService } from '@libs/common/browser/browser.service';
import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { GotoOptionsDto } from './dto/goto.dto';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly browserService: BrowserService) {}

  async executeOptions(
    page: Page,
    options: GotoOptionsDto[],
    sleepTime: number,
  ) {
    for (const option of options) {
      await this.browserService.scrollAndClick(page, option.click_element, {
        scrollDelay: option.scroll_delay,
        clickOptions: {
          force: true,
          delay: 500,
          position: { x: 10, y: 10 },
          closeNewPage: option.close_new_page, // This will close any new page that opens
          newPageTimeout: option.wait_new_page,
        },
      });

      await this.sleep(sleepTime);
    }
  }

  sleep(sec: number) {
    this.logger.verbose(`Sleeping for ${sec} seconds`);
    return new Promise((resolve) => {
      setTimeout(resolve, sec * 1000);
    });
  }

  getHello(): string {
    return 'Hello World!';
  }
}
