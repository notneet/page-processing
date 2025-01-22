import { BrowserModule } from '@libs/common/browser/browser.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [BrowserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
