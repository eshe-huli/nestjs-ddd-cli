import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyBusinessReferenceIdentifiersRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const referencesPath = path.join(sharedPath, 'business-references');

  await ensureDir(referencesPath);

  const typesContent = `export interface BusinessReferenceInput {
  /**
   * Short service prefix, for example PSW, KOR, VHQ, CRH.
   */
  service: string;

  /**
   * Short record type, for example SET, FXQ, KYC, LVN, INV.
   */
  type: string;

  /**
   * ISO 3166 alpha-2 country code when market context matters.
   */
  country?: string;

  /**
   * ISO 4217 currency code when a single currency matters.
   */
  currency?: string;

  /**
   * Currency pair without separator, for example XOFUSD.
   */
  currencyPair?: string;

  /**
   * Optional rail or provider hint when it materially helps operations.
   */
  rail?: string;

  /**
   * Defaults to the creation time.
   */
  occurredAt?: Date;

  /**
   * Include epoch seconds for partner file reconciliation or chronological sorting outside the DB.
   */
  includeEpoch?: boolean;

  /**
   * Random Crockford/base36 suffix length. Defaults to 6.
   */
  randomLength?: number;
}

export interface BusinessReferenceParts {
  service: string;
  type: string;
  country?: string;
  currencyOrPair?: string;
  rail?: string;
  timestamp: string;
  epoch?: string;
  random: string;
}

export interface BusinessReferenceGeneratorPort {
  generate(input: BusinessReferenceInput): string;
}
`;

  await writeFile(path.join(referencesPath, 'business-reference.types.ts'), typesContent);

  const generatorContent = `import { randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";
import {
  BusinessReferenceGeneratorPort,
  BusinessReferenceInput,
  BusinessReferenceParts,
} from "./business-reference.types";

const SAFE_SEGMENT = /^[A-Z0-9][A-Z0-9_-]{1,15}$/;
const SAFE_RANDOM_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

@Injectable()
export class BusinessReferenceGenerator implements BusinessReferenceGeneratorPort {
  generate(input: BusinessReferenceInput): string {
    const occurredAt = input.occurredAt ?? new Date();
    const randomLength = input.randomLength ?? 6;

    const parts: BusinessReferenceParts = {
      service: this.normalizeSegment(input.service, "service"),
      type: this.normalizeSegment(input.type, "type"),
      country: input.country ? this.normalizeSegment(input.country, "country") : undefined,
      currencyOrPair: this.currencySegment(input),
      rail: input.rail ? this.normalizeSegment(input.rail, "rail") : undefined,
      timestamp: this.utcTimestamp(occurredAt),
      epoch: input.includeEpoch ? Math.floor(occurredAt.getTime() / 1000).toString() : undefined,
      random: this.randomSuffix(randomLength),
    };

    return [
      parts.service,
      parts.type,
      parts.country,
      parts.currencyOrPair,
      parts.rail,
      parts.timestamp,
      parts.epoch,
      parts.random,
    ]
      .filter((part): part is string => Boolean(part))
      .join("-");
  }

  private currencySegment(input: BusinessReferenceInput): string | undefined {
    if (input.currencyPair && input.currency) {
      throw new Error("Use either currency or currencyPair, not both");
    }

    if (input.currencyPair) {
      return this.normalizeSegment(input.currencyPair, "currencyPair");
    }

    if (input.currency) {
      return this.normalizeSegment(input.currency, "currency");
    }

    return undefined;
  }

  private normalizeSegment(value: string, label: string): string {
    const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase();
    if (!SAFE_SEGMENT.test(normalized)) {
      throw new Error(
        "Invalid " + label + " segment for business reference: " + value,
      );
    }
    return normalized;
  }

  private utcTimestamp(date: Date): string {
    const year = date.getUTCFullYear().toString().padStart(4, "0");
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
    const hour = date.getUTCHours().toString().padStart(2, "0");
    const minute = date.getUTCMinutes().toString().padStart(2, "0");
    const second = date.getUTCSeconds().toString().padStart(2, "0");

    return year + month + day + "T" + hour + minute + second;
  }

  private randomSuffix(length: number): string {
    if (!Number.isInteger(length) || length < 4 || length > 16) {
      throw new Error("Business reference randomLength must be between 4 and 16");
    }

    const bytes = randomBytes(length);
    let output = "";
    for (const byte of bytes) {
      output += SAFE_RANDOM_ALPHABET[byte % SAFE_RANDOM_ALPHABET.length];
    }
    return output;
  }
}
`;

  await writeFile(path.join(referencesPath, 'business-reference.generator.ts'), generatorContent);

  const moduleContent = `import { Module } from "@nestjs/common";
import { BusinessReferenceGenerator } from "./business-reference.generator";

@Module({
  providers: [BusinessReferenceGenerator],
  exports: [BusinessReferenceGenerator],
})
export class BusinessReferenceModule {}
`;

  await writeFile(path.join(referencesPath, 'business-reference.module.ts'), moduleContent);

  const indexContent = `export * from "./business-reference.types";
export * from "./business-reference.generator";
export * from "./business-reference.module";
`;

  await writeFile(path.join(referencesPath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ Business reference generator'));
  console.log(chalk.green('  ✓ Business reference module'));
  console.log(chalk.green('  ✓ UUID/id remains canonical; reference is sidecar metadata'));
}
