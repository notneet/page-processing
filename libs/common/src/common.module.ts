import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { BrowserModule } from './browser/browser.module';

@Module({
  providers: [CommonService],
  exports: [CommonService],
  imports: [BrowserModule],
})
export class CommonModule {}
