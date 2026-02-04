/**
 * Internationalization (i18n) & Localization Engine Generator
 * Generates comprehensive i18n infrastructure
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface I18nOptions {
  path?: string;
  defaultLocale?: string;
  supportedLocales?: string[];
}

export async function setupI18n(
  basePath: string,
  options: I18nOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🌍 Setting up i18n Infrastructure\n'));

  const sharedPath = path.join(basePath, 'src/shared/i18n');
  const localesPath = path.join(basePath, 'src/locales');

  for (const dir of [sharedPath, localesPath]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Generate i18n module
  const moduleContent = generateI18nModule(options);
  fs.writeFileSync(path.join(sharedPath, 'i18n.module.ts'), moduleContent);
  console.log(chalk.green(`  ✓ Created i18n module`));

  // Generate i18n service
  const serviceContent = generateI18nService();
  fs.writeFileSync(path.join(sharedPath, 'i18n.service.ts'), serviceContent);
  console.log(chalk.green(`  ✓ Created i18n service`));

  // Generate translation loader
  const loaderContent = generateTranslationLoader();
  fs.writeFileSync(path.join(sharedPath, 'translation.loader.ts'), loaderContent);
  console.log(chalk.green(`  ✓ Created translation loader`));

  // Generate locale interceptor
  const interceptorContent = generateLocaleInterceptor();
  fs.writeFileSync(path.join(sharedPath, 'locale.interceptor.ts'), interceptorContent);
  console.log(chalk.green(`  ✓ Created locale interceptor`));

  // Generate i18n decorators
  const decoratorContent = generateI18nDecorators();
  fs.writeFileSync(path.join(sharedPath, 'i18n.decorators.ts'), decoratorContent);
  console.log(chalk.green(`  ✓ Created i18n decorators`));

  // Generate sample locale files
  generateSampleLocales(localesPath, options);

  console.log(chalk.bold.green('\n✅ i18n infrastructure ready!\n'));
}

function generateI18nModule(options: I18nOptions): string {
  const defaultLocale = options.defaultLocale || 'en';
  const supportedLocales = options.supportedLocales || ['en', 'fr', 'es'];

  return `import { Module, Global, DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { I18nService } from './i18n.service';
import { TranslationLoader } from './translation.loader';
import { LocaleInterceptor } from './locale.interceptor';

export interface I18nModuleOptions {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale?: string;
  localesPath: string;
  resolvers?: LocaleResolver[];
  enableCaching?: boolean;
}

export type LocaleResolver = 'header' | 'query' | 'cookie' | 'accept-language';

@Global()
@Module({})
export class I18nModule {
  static forRoot(options: I18nModuleOptions): DynamicModule {
    return {
      module: I18nModule,
      providers: [
        {
          provide: 'I18N_OPTIONS',
          useValue: options,
        },
        TranslationLoader,
        I18nService,
        {
          provide: APP_INTERCEPTOR,
          useClass: LocaleInterceptor,
        },
      ],
      exports: [I18nService, TranslationLoader],
    };
  }
}

/**
 * Default i18n configuration
 */
export const DEFAULT_I18N_OPTIONS: Partial<I18nModuleOptions> = {
  defaultLocale: '${defaultLocale}',
  supportedLocales: ${JSON.stringify(supportedLocales)},
  fallbackLocale: '${defaultLocale}',
  resolvers: ['header', 'accept-language'],
  enableCaching: true,
};
`;
}

function generateI18nService(): string {
  return `import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { TranslationLoader } from './translation.loader';

export interface TranslateOptions {
  locale?: string;
  defaultValue?: string;
  args?: Record<string, any>;
  count?: number;
}

@Injectable()
export class I18nService implements OnModuleInit {
  private readonly logger = new Logger(I18nService.name);
  private currentLocale: string;
  private translations: Map<string, Record<string, any>> = new Map();

  constructor(
    @Inject('I18N_OPTIONS') private readonly options: any,
    private readonly loader: TranslationLoader,
  ) {
    this.currentLocale = options.defaultLocale;
  }

  async onModuleInit() {
    await this.loadTranslations();
  }

  private async loadTranslations(): Promise<void> {
    for (const locale of this.options.supportedLocales) {
      try {
        const translations = await this.loader.load(locale);
        this.translations.set(locale, translations);
        this.logger.log(\`Loaded translations for locale: \${locale}\`);
      } catch (error) {
        this.logger.warn(\`Failed to load translations for locale: \${locale}\`);
      }
    }
  }

  /**
   * Translate a key
   */
  t(key: string, options?: TranslateOptions): string {
    const locale = options?.locale || this.currentLocale;
    const translations = this.translations.get(locale);

    if (!translations) {
      return this.fallback(key, options);
    }

    let value = this.getNestedValue(translations, key);

    if (value === undefined) {
      return this.fallback(key, options);
    }

    // Handle pluralization
    if (typeof value === 'object' && options?.count !== undefined) {
      value = this.pluralize(value, options.count);
    }

    // Handle interpolation
    if (options?.args) {
      value = this.interpolate(value, options.args);
    }

    return value;
  }

  /**
   * Translate with context
   */
  translate(key: string, options?: TranslateOptions): string {
    return this.t(key, options);
  }

  /**
   * Check if translation exists
   */
  exists(key: string, locale?: string): boolean {
    const translations = this.translations.get(locale || this.currentLocale);
    return translations ? this.getNestedValue(translations, key) !== undefined : false;
  }

  /**
   * Get all translations for a namespace
   */
  getNamespace(namespace: string, locale?: string): Record<string, any> {
    const translations = this.translations.get(locale || this.currentLocale);
    return translations ? this.getNestedValue(translations, namespace) || {} : {};
  }

  /**
   * Set current locale
   */
  setLocale(locale: string): void {
    if (this.options.supportedLocales.includes(locale)) {
      this.currentLocale = locale;
    } else {
      this.logger.warn(\`Unsupported locale: \${locale}\`);
    }
  }

  /**
   * Get current locale
   */
  getLocale(): string {
    return this.currentLocale;
  }

  /**
   * Get supported locales
   */
  getSupportedLocales(): string[] {
    return this.options.supportedLocales;
  }

  /**
   * Format date
   */
  formatDate(date: Date, format?: Intl.DateTimeFormatOptions, locale?: string): string {
    return new Intl.DateTimeFormat(locale || this.currentLocale, format).format(date);
  }

  /**
   * Format number
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions, locale?: string): string {
    return new Intl.NumberFormat(locale || this.currentLocale, options).format(value);
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number, currency: string, locale?: string): string {
    return new Intl.NumberFormat(locale || this.currentLocale, {
      style: 'currency',
      currency,
    }).format(amount);
  }

  /**
   * Format relative time
   */
  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, locale?: string): string {
    return new Intl.RelativeTimeFormat(locale || this.currentLocale, {
      numeric: 'auto',
    }).format(value, unit);
  }

  private fallback(key: string, options?: TranslateOptions): string {
    // Try fallback locale
    if (this.options.fallbackLocale && this.options.fallbackLocale !== this.currentLocale) {
      const fallbackTranslations = this.translations.get(this.options.fallbackLocale);
      if (fallbackTranslations) {
        const value = this.getNestedValue(fallbackTranslations, key);
        if (value !== undefined) {
          return typeof value === 'string' ? value : key;
        }
      }
    }

    return options?.defaultValue || key;
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private pluralize(value: Record<string, string>, count: number): string {
    if (count === 0 && value.zero) return value.zero;
    if (count === 1 && value.one) return value.one;
    if (value.other) return value.other;
    return Object.values(value)[0] || '';
  }

  private interpolate(text: string, args: Record<string, any>): string {
    return text.replace(/\\{\\{(\\w+)\\}\\}/g, (match, key) => {
      return args[key] !== undefined ? String(args[key]) : match;
    });
  }

  /**
   * Reload translations
   */
  async reload(): Promise<void> {
    this.translations.clear();
    await this.loadTranslations();
  }
}
`;
}

function generateTranslationLoader(): string {
  return `import { Injectable, Inject, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TranslationLoader {
  private readonly logger = new Logger(TranslationLoader.name);
  private cache: Map<string, Record<string, any>> = new Map();

  constructor(@Inject('I18N_OPTIONS') private readonly options: any) {}

  /**
   * Load translations for a locale
   */
  async load(locale: string): Promise<Record<string, any>> {
    // Check cache
    if (this.options.enableCaching && this.cache.has(locale)) {
      return this.cache.get(locale)!;
    }

    const translations: Record<string, any> = {};
    const localeDir = path.join(this.options.localesPath, locale);

    if (!fs.existsSync(localeDir)) {
      // Try single file format
      const singleFile = path.join(this.options.localesPath, \`\${locale}.json\`);
      if (fs.existsSync(singleFile)) {
        const content = fs.readFileSync(singleFile, 'utf-8');
        const parsed = JSON.parse(content);
        if (this.options.enableCaching) {
          this.cache.set(locale, parsed);
        }
        return parsed;
      }
      throw new Error(\`Locale directory or file not found: \${locale}\`);
    }

    // Load all JSON files in locale directory
    const files = fs.readdirSync(localeDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const namespace = path.basename(file, '.json');
      const filePath = path.join(localeDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      translations[namespace] = JSON.parse(content);
    }

    if (this.options.enableCaching) {
      this.cache.set(locale, translations);
    }

    return translations;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get available locales
   */
  getAvailableLocales(): string[] {
    const localesPath = this.options.localesPath;

    if (!fs.existsSync(localesPath)) {
      return [];
    }

    const entries = fs.readdirSync(localesPath, { withFileTypes: true });
    const locales: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        locales.push(entry.name);
      } else if (entry.name.endsWith('.json')) {
        locales.push(entry.name.replace('.json', ''));
      }
    }

    return locales;
  }
}
`;
}

function generateLocaleInterceptor(): string {
  return `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { I18nService } from './i18n.service';

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  constructor(
    private readonly i18n: I18nService,
    @Inject('I18N_OPTIONS') private readonly options: any,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Detect locale from request
    const locale = this.detectLocale(request);

    // Set locale for this request
    request.locale = locale;
    request.i18n = this.i18n;

    // Set locale header in response
    response.setHeader('Content-Language', locale);

    return next.handle();
  }

  private detectLocale(request: any): string {
    const resolvers = this.options.resolvers || ['header', 'accept-language'];
    const supportedLocales = this.options.supportedLocales;

    for (const resolver of resolvers) {
      const locale = this.resolveLocale(resolver, request);
      if (locale && supportedLocales.includes(locale)) {
        return locale;
      }
    }

    return this.options.defaultLocale;
  }

  private resolveLocale(resolver: string, request: any): string | null {
    switch (resolver) {
      case 'header':
        return request.headers['x-locale'] || request.headers['x-lang'];

      case 'query':
        return request.query.locale || request.query.lang;

      case 'cookie':
        return request.cookies?.locale;

      case 'accept-language':
        return this.parseAcceptLanguage(request.headers['accept-language']);

      default:
        return null;
    }
  }

  private parseAcceptLanguage(header: string | undefined): string | null {
    if (!header) return null;

    const locales = header.split(',').map(lang => {
      const [locale, priority = 'q=1.0'] = lang.trim().split(';');
      const q = parseFloat(priority.replace('q=', ''));
      return { locale: locale.split('-')[0], priority: q };
    });

    locales.sort((a, b) => b.priority - a.priority);

    return locales[0]?.locale || null;
  }
}
`;
}

function generateI18nDecorators(): string {
  return `import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

/**
 * Get current locale from request
 */
export const CurrentLocale = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.locale;
  },
);

/**
 * Get i18n service from request
 */
export const I18n = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.i18n;
  },
);

/**
 * Get translation function from request
 */
export const T = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const locale = request.locale;
    return (key: string, args?: Record<string, any>) => {
      return request.i18n?.t(key, { locale, args }) || key;
    };
  },
);

/**
 * Set required locale for endpoint
 */
export function RequireLocale(...locales: string[]) {
  return SetMetadata('requiredLocales', locales);
}

/**
 * Mark endpoint as locale-specific
 */
export function LocaleSpecific() {
  return SetMetadata('localeSpecific', true);
}
`;
}

function generateSampleLocales(localesPath: string, options: I18nOptions): void {
  const locales = options.supportedLocales || ['en', 'fr', 'es'];

  const translations: Record<string, Record<string, any>> = {
    en: {
      common: {
        welcome: 'Welcome',
        hello: 'Hello, {{name}}!',
        goodbye: 'Goodbye',
        yes: 'Yes',
        no: 'No',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        loading: 'Loading...',
        error: 'An error occurred',
        success: 'Success',
      },
      errors: {
        notFound: 'Resource not found',
        unauthorized: 'Unauthorized access',
        forbidden: 'Access forbidden',
        validation: 'Validation error',
        serverError: 'Internal server error',
      },
      validation: {
        required: '{{field}} is required',
        email: 'Invalid email format',
        minLength: '{{field}} must be at least {{min}} characters',
        maxLength: '{{field}} must not exceed {{max}} characters',
      },
      plurals: {
        items: {
          zero: 'No items',
          one: '1 item',
          other: '{{count}} items',
        },
      },
    },
    fr: {
      common: {
        welcome: 'Bienvenue',
        hello: 'Bonjour, {{name}} !',
        goodbye: 'Au revoir',
        yes: 'Oui',
        no: 'Non',
        save: 'Enregistrer',
        cancel: 'Annuler',
        delete: 'Supprimer',
        edit: 'Modifier',
        loading: 'Chargement...',
        error: 'Une erreur est survenue',
        success: 'Succès',
      },
      errors: {
        notFound: 'Ressource non trouvée',
        unauthorized: 'Accès non autorisé',
        forbidden: 'Accès interdit',
        validation: 'Erreur de validation',
        serverError: 'Erreur interne du serveur',
      },
      validation: {
        required: '{{field}} est requis',
        email: 'Format email invalide',
        minLength: '{{field}} doit contenir au moins {{min}} caractères',
        maxLength: '{{field}} ne doit pas dépasser {{max}} caractères',
      },
      plurals: {
        items: {
          zero: 'Aucun élément',
          one: '1 élément',
          other: '{{count}} éléments',
        },
      },
    },
    es: {
      common: {
        welcome: 'Bienvenido',
        hello: '¡Hola, {{name}}!',
        goodbye: 'Adiós',
        yes: 'Sí',
        no: 'No',
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
        edit: 'Editar',
        loading: 'Cargando...',
        error: 'Se produjo un error',
        success: 'Éxito',
      },
      errors: {
        notFound: 'Recurso no encontrado',
        unauthorized: 'Acceso no autorizado',
        forbidden: 'Acceso prohibido',
        validation: 'Error de validación',
        serverError: 'Error interno del servidor',
      },
      validation: {
        required: '{{field}} es requerido',
        email: 'Formato de email inválido',
        minLength: '{{field}} debe tener al menos {{min}} caracteres',
        maxLength: '{{field}} no debe exceder {{max}} caracteres',
      },
      plurals: {
        items: {
          zero: 'Ningún elemento',
          one: '1 elemento',
          other: '{{count}} elementos',
        },
      },
    },
  };

  for (const locale of locales) {
    const localeDir = path.join(localesPath, locale);
    if (!fs.existsSync(localeDir)) {
      fs.mkdirSync(localeDir, { recursive: true });
    }

    const trans = translations[locale] || translations.en;

    for (const [namespace, content] of Object.entries(trans)) {
      fs.writeFileSync(
        path.join(localeDir, `${namespace}.json`),
        JSON.stringify(content, null, 2)
      );
    }

    console.log(chalk.green(`  ✓ Created locale files for: ${locale}`));
  }
}
