import { Controller, Post, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ClassificationService } from './classification.service.js';

@Controller('leads')
export class ClassificationController {
  constructor(private readonly classificationService: ClassificationService) {}

  @Post(':id/classification')
  requestClassification(@Param('id', ParseUUIDPipe) id: string) {
    return this.classificationService.requestClassification(id);
  }

  @Get(':id/classifications')
  getClassificationHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.classificationService.getClassificationHistory(id);
  }
}
