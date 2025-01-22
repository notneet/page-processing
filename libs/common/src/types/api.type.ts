export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  error: string;
  data: T;
}
