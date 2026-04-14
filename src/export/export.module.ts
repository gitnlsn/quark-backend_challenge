import { Module } from '@nestjs/common';
import { ExportService } from './export.service.js';

@Module({
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
