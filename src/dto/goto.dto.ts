import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum TWaitUntil {
  load = 'load',
  domcontentloaded = 'domcontentloaded',
  networkidle = 'networkidle',
}

export class GotoDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsEnum(TWaitUntil)
  @IsOptional()
  wait_until: TWaitUntil = TWaitUntil.load;

  @IsString()
  @IsNotEmpty()
  wait_for_selector: string;

  @IsNumber()
  @IsOptional()
  sleep_time: number = 2;

  @IsNumber()
  @IsNotEmpty()
  max_scrolls: number = 50;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => GotoOptionsDto)
  options?: GotoOptionsDto[];
}

export class GotoOptionsDto {
  @IsNumber()
  @IsOptional()
  scroll_delay: number = 1000;

  @IsString()
  @IsNotEmpty()
  click_element: string;

  @IsBoolean()
  @IsOptional()
  close_new_page: boolean = false;

  @IsNumber()
  @IsOptional()
  wait_new_page: number = 3000;
}
