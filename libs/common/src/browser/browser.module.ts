import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrowserController } from './browser.controller';
import { BrowserService } from './browser.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [BrowserController],
  providers: [BrowserService],
  exports: [BrowserService],
})
export class BrowserModule {}
