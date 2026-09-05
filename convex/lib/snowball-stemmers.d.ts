declare module 'snowball-stemmers' {
  export interface Stemmer {
    stem(word: string): string;
  }
  export function newStemmer(algorithm: 'spanish' | 'english'): Stemmer;
  export function algorithms(): string[];
}
