import { Module } from '@nestjs/common';
import { ClassificationController } from './classification.controller.js';
import { ClassificationService } from './classification.service.js';
import { ClassificationWorker } from './classification.worker.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [AiModule],
  controllers: [ClassificationController],
  providers: [ClassificationService, ClassificationWorker],
})
export class ClassificationModule {}
