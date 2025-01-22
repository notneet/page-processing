import { BrowserService } from '@libs/common/browser/browser.service';
import { ApiResponse } from '@libs/common/types/api.type';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { arrayNotEmpty, isEmpty, isNotEmpty } from 'class-validator';
import { AppService } from './app.service';
import { GotoDto } from './dto/goto.dto';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly browserService: BrowserService,
  ) {}

  @Post('goto')
  @HttpCode(HttpStatus.OK)
  async createPage(
    @Body() body: GotoDto,
  ): Promise<ApiResponse<{ html: string }>> {
    let pageId: string | null = null;

    try {
      this.logger.verbose(`Processing request: ${JSON.stringify(body)}`);

      pageId = await this.browserService.createPage();
      const page = await this.browserService.getPage(pageId);

      if (isEmpty(page)) {
        throw new Error('Failed to create page');
      }

      await page.goto(body.url, {
        waitUntil: body.wait_until,
      });

      await page.waitForSelector(body.wait_for_selector, {
        state: 'visible',
      });

      await this.browserService.autoScroll(page, {
        maxScrolls: body.max_scrolls,
      });

      await this.appService.sleep(body.sleep_time);

      if (arrayNotEmpty(body.options)) {
        await this.appService.executeOptions(
          page,
          body.options,
          body.sleep_time,
        );
      }

      const dataHtml = await page.content();

      this.logger.verbose(`Page processsing completed: ${body.url}`);

      return {
        message: 'Page processing successfully',
        statusCode: HttpStatus.OK,
        error: null,
        data: {
          html: dataHtml,
        },
      };
    } catch (error) {
      this.logger.error(`Page processing failed: ${body.url}`);
      this.logger.error(error);
      throw new UnprocessableEntityException(error?.message);
    } finally {
      if (isNotEmpty(pageId)) {
        await this.browserService.releasePage(pageId);
      }
    }
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
