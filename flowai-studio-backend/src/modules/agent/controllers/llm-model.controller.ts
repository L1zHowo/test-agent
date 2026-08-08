import { Controller, Get, Param } from '@nestjs/common';
import { LLMModelService } from '../services/llm-model.service';

@Controller('llm')
export class LLMModelController {
  constructor(private readonly llmModelService: LLMModelService) {}

  @Get('models')
  getModels() {
    return this.llmModelService.getModelsGroupByProvider();
  }

  @Get('models/list')
  getAllModels() {
    return this.llmModelService.getAllModels();
  }

  @Get('models/:modelId')
  getModelInfo(@Param('modelId') modelId: string) {
    return this.llmModelService.getModelInfo(modelId);
  }

  @Get('health')
  async healthCheck() {
    return this.llmModelService.healthCheck();
  }

}
