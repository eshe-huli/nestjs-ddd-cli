import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface AiAssistOptions {
  path?: string;
  apiKey?: string;
  model?: string;
  provider?: 'anthropic' | 'openai';
}

interface GenerationContext {
  moduleName: string;
  entityName: string;
  existingCode?: string;
  requirements?: string;
}

export async function aiAssist(action: string, options: AiAssistOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n🤖 AI-Assisted Code Generation\n'));

  // Check for API key
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log(chalk.yellow('⚠️  No API key found.'));
    console.log(chalk.gray('\nSet one of the following environment variables:'));
    console.log(chalk.gray('  ANTHROPIC_API_KEY - for Claude'));
    console.log(chalk.gray('  OPENAI_API_KEY - for GPT-4'));
    console.log(chalk.gray('\nOr pass --api-key=<key> to the command.'));

    // Generate template without AI
    await generateTemplate(action, options);
    return;
  }

  const provider = options.provider || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai');

  console.log(chalk.cyan(`Using ${provider} API...`));

  switch (action) {
    case 'usecase':
      await generateUseCase(options, apiKey, provider);
      break;
    case 'service':
      await generateService(options, apiKey, provider);
      break;
    case 'test':
      await generateTest(options, apiKey, provider);
      break;
    case 'refactor':
      await refactorCode(options, apiKey, provider);
      break;
    case 'explain':
      await explainCode(options, apiKey, provider);
      break;
    default:
      console.log(chalk.yellow(`Unknown action: ${action}`));
      console.log(chalk.gray('Available actions: usecase, service, test, refactor, explain'));
  }
}

async function generateTemplate(action: string, options: AiAssistOptions): Promise<void> {
  console.log(chalk.cyan('\nGenerating template without AI...\n'));

  const basePath = options.path || process.cwd();

  const templates: Record<string, string> = {
    usecase: `import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

// TODO: Define your command
export class YourCommand {
  constructor(
    // Add command properties
  ) {}
}

@CommandHandler(YourCommand)
export class YourCommandHandler implements ICommandHandler<YourCommand> {
  constructor(
    // Inject dependencies
  ) {}

  async execute(command: YourCommand): Promise<void> {
    // TODO: Implement use case logic
    // 1. Validate input
    // 2. Execute business logic
    // 3. Persist changes
    // 4. Emit domain events
  }
}
`,
    service: `import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class YourService {
  private readonly logger = new Logger(YourService.name);

  constructor(
    // Inject dependencies
  ) {}

  async yourMethod(): Promise<void> {
    // TODO: Implement service method
    this.logger.log('Method called');
  }
}
`,
    test: `import { Test, TestingModule } from '@nestjs/testing';

describe('YourService', () => {
  let service: YourService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YourService,
        // Add mock providers
      ],
    }).compile();

    service = module.get<YourService>(YourService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // TODO: Add more tests
});
`,
  };

  const template = templates[action] || templates.service;
  console.log(chalk.gray('─'.repeat(50)));
  console.log(template);
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.yellow('\nTip: Set ANTHROPIC_API_KEY or OPENAI_API_KEY for AI-generated code.'));
}

async function generateUseCase(options: AiAssistOptions, apiKey: string, provider: string): Promise<void> {
  const prompt = `Generate a NestJS use case (command handler) following DDD and CQRS patterns.
The use case should:
1. Have a Command class with proper properties
2. Have a CommandHandler that implements ICommandHandler
3. Include proper validation
4. Emit domain events if applicable
5. Handle errors appropriately

Please provide a complete, production-ready implementation.`;

  const response = await callAI(prompt, apiKey, provider, options.model);
  console.log(chalk.green('\n✓ Generated use case:\n'));
  console.log(response);
}

async function generateService(options: AiAssistOptions, apiKey: string, provider: string): Promise<void> {
  const prompt = `Generate a NestJS service following best practices:
1. Use dependency injection
2. Include proper logging with Logger
3. Add error handling
4. Include JSDoc comments
5. Follow single responsibility principle

Please provide a complete, production-ready implementation.`;

  const response = await callAI(prompt, apiKey, provider, options.model);
  console.log(chalk.green('\n✓ Generated service:\n'));
  console.log(response);
}

async function generateTest(options: AiAssistOptions, apiKey: string, provider: string): Promise<void> {
  const basePath = options.path || process.cwd();

  // Try to read an existing file to generate tests for
  const prompt = `Generate comprehensive Jest unit tests for a NestJS service.
Include:
1. Setup with TestingModule
2. Mock dependencies
3. Test all public methods
4. Test edge cases and error scenarios
5. Use describe/it blocks appropriately

Please provide complete, runnable test code.`;

  const response = await callAI(prompt, apiKey, provider, options.model);
  console.log(chalk.green('\n✓ Generated tests:\n'));
  console.log(response);
}

async function refactorCode(options: AiAssistOptions, apiKey: string, provider: string): Promise<void> {
  console.log(chalk.cyan('Reading code for refactoring...'));

  const prompt = `Please analyze and refactor this code to:
1. Improve readability and maintainability
2. Follow SOLID principles
3. Add proper TypeScript types
4. Improve error handling
5. Add appropriate comments

Please explain the changes you made.`;

  const response = await callAI(prompt, apiKey, provider, options.model);
  console.log(chalk.green('\n✓ Refactoring suggestions:\n'));
  console.log(response);
}

async function explainCode(options: AiAssistOptions, apiKey: string, provider: string): Promise<void> {
  console.log(chalk.cyan('Analyzing code...'));

  const prompt = `Please explain this code:
1. What does it do?
2. What patterns/principles does it follow?
3. What are potential improvements?
4. Are there any bugs or issues?`;

  const response = await callAI(prompt, apiKey, provider, options.model);
  console.log(chalk.green('\n✓ Code explanation:\n'));
  console.log(response);
}

async function callAI(prompt: string, apiKey: string, provider: string, model?: string): Promise<string> {
  // This is a simplified implementation
  // In production, you would use the actual API clients

  if (provider === 'anthropic') {
    return callAnthropic(prompt, apiKey, model);
  } else {
    return callOpenAI(prompt, apiKey, model);
  }
}

async function callAnthropic(prompt: string, apiKey: string, model?: string): Promise<string> {
  const selectedModel = model || 'claude-3-sonnet-20240229';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: 'You are an expert NestJS and TypeScript developer. Generate clean, production-ready code following best practices.',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${error}`);
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content[0].text;
  } catch (error) {
    console.log(chalk.red(`API call failed: ${(error as Error).message}`));
    return generateFallbackResponse(prompt);
  }
}

async function callOpenAI(prompt: string, apiKey: string, model?: string): Promise<string> {
  const selectedModel = model || 'gpt-4-turbo-preview';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: 'You are an expert NestJS and TypeScript developer. Generate clean, production-ready code following best practices.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${error}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content;
  } catch (error) {
    console.log(chalk.red(`API call failed: ${(error as Error).message}`));
    return generateFallbackResponse(prompt);
  }
}

function generateFallbackResponse(prompt: string): string {
  return `// AI generation failed. Here's a template to start with:
// Prompt was: ${prompt.substring(0, 100)}...

import { Injectable } from '@nestjs/common';

@Injectable()
export class GeneratedService {
  // TODO: Implement based on requirements
}
`;
}

// Configuration for AI assist
export async function configureAiAssist(basePath: string): Promise<void> {
  const configPath = path.join(basePath, '.ddd');
  await ensureDir(configPath);

  const config = {
    ai: {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      maxTokens: 4096,
      temperature: 0.7,
    },
    prompts: {
      usecase: 'Generate a use case following DDD patterns',
      service: 'Generate a service with proper error handling',
      test: 'Generate comprehensive unit tests',
    },
  };

  await writeFile(path.join(configPath, 'ai-config.json'), JSON.stringify(config, null, 2));
  console.log(chalk.green('✓ Created .ddd/ai-config.json'));
  console.log(chalk.gray('\nSet ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable to use AI features.'));
}
