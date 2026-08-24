import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './user-agent';

const CHROME_LINUX =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const FIREFOX_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:129.0) Gecko/20100101 Firefox/129.0';

describe('describeUserAgent', () => {
  it('distingue Chrome de Safari aunque Chrome también anuncie Safari', () => {
    expect(describeUserAgent(CHROME_LINUX)).toEqual({ browser: 'Chrome', os: 'Linux', mobile: false });
    expect(describeUserAgent(SAFARI_IPHONE)).toEqual({ browser: 'Safari', os: 'iOS', mobile: true });
  });

  it('distingue Edge aunque también anuncie Chrome', () => {
    expect(describeUserAgent(EDGE_WINDOWS)).toEqual({ browser: 'Edge', os: 'Windows', mobile: false });
  });

  it('Android gana a Linux y cuenta como móvil', () => {
    expect(describeUserAgent(CHROME_ANDROID)).toEqual({ browser: 'Chrome', os: 'Android', mobile: true });
  });

  it('reconoce Firefox en macOS', () => {
    expect(describeUserAgent(FIREFOX_MAC)).toEqual({ browser: 'Firefox', os: 'macOS', mobile: false });
  });

  it('cae en desconocido sin User-Agent o con uno irreconocible', () => {
    expect(describeUserAgent(null).browser).toBe('Navegador desconocido');
    expect(describeUserAgent('curl/8.0').browser).toBe('Navegador desconocido');
  });
});
