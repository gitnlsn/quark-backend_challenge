import { Module } from '@nestjs/common';
import { MockApiClientService } from './mock-api-client.service.js';

@Module({
  providers: [MockApiClientService],
  exports: [MockApiClientService],
})
export class MockApiClientModule {}
