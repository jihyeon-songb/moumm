// LLM 제공자 인터페이스. 제공자를 바꿀 때는 이 인터페이스를 구현하는 파일 하나만 추가한다.

export type GenerateInput = {
  system: string;
  user: string;
  jsonSchema: object;
};

export type GenerateOutput = {
  /** 모델이 돌려준 JSON 문자열 */
  text: string;
  model: string;
  ms: number;
  inputTokens?: number;
  outputTokens?: number;
};

export interface ClueProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<GenerateOutput>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
