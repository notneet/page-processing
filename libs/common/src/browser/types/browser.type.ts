import { Page } from 'playwright';

export enum PageState {
  IDLE = 'idle',
  IN_USE = 'in_use',
  DONE = 'done',
}

export interface BrowserPage {
  page: Page;
  state: PageState;
  lastUsed: Date;
}

export interface ScrollOptions {
  scrollDelay?: number; // Delay between scrolls (ms)
  maxScrolls?: number; // Maximum number of scroll attempts
  scrollStep?: number; // Pixels to scroll each time
  bottomThreshold?: number; // Pixels from bottom to consider as "bottom"
  waitForSelector?: string; // Optional selector to wait after each scroll
  scrollBehavior?: 'smooth' | 'auto'; // Scroll behavior
}
