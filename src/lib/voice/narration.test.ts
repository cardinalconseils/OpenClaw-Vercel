import { describe, it, expect } from 'vitest';
import {
  buildResultNarration,
  buildNextProviderNarration,
  buildNoResultsNarration,
  buildSearchingFiller,
} from './narration.js';

const TOP_PROVIDER_EN = { name: 'Acme Plumbing', rating: 4.8, distanceKm: 2.3 };
const TOP_PROVIDER_FR = { name: 'PlombPro', rating: 4.5, distanceKm: 1.1 };

describe('buildResultNarration', () => {
  it('EN: contains count, service type, location', () => {
    const result = buildResultNarration(6, 'plumber', 'downtown Austin', TOP_PROVIDER_EN, 'en');
    expect(result).toContain('6');
    expect(result).toContain('plumber');
    expect(result).toContain('downtown Austin');
  });

  it('EN: contains top provider name and rating', () => {
    const result = buildResultNarration(6, 'plumber', 'downtown Austin', TOP_PROVIDER_EN, 'en');
    expect(result).toContain('Acme Plumbing');
    expect(result).toContain('4.8');
    expect(result.toLowerCase()).toContain('star');
  });

  it('EN: contains call-to-action question', () => {
    const result = buildResultNarration(6, 'plumber', 'downtown Austin', TOP_PROVIDER_EN, 'en');
    expect(result).toContain('?');
  });

  it('FR: contains J\'ai trouve and count', () => {
    const result = buildResultNarration(3, 'plombier', 'Montreal', TOP_PROVIDER_FR, 'fr');
    expect(result).toContain("J'ai trouve");
    expect(result).toContain('3');
    expect(result).toContain('Montreal');
  });

  it('FR: contains provider name and rating', () => {
    const result = buildResultNarration(3, 'plombier', 'Montreal', TOP_PROVIDER_FR, 'fr');
    expect(result).toContain('PlombPro');
    expect(result).toContain('4.5');
  });

  it('EN: no unresolved template literals', () => {
    const result = buildResultNarration(6, 'plumber', 'downtown Austin', TOP_PROVIDER_EN, 'en');
    expect(result).not.toMatch(/\$\{/);
  });

  it('FR: no unresolved template literals', () => {
    const result = buildResultNarration(3, 'plombier', 'Montreal', TOP_PROVIDER_FR, 'fr');
    expect(result).not.toMatch(/\$\{/);
  });
});

describe('buildNextProviderNarration', () => {
  const NEXT_EN = { name: "Bob's Plumbing", rating: 4.6, distanceKm: 1.5 };
  const NEXT_FR = { name: 'PlombMax', rating: 4.2, distanceKm: 3.0 };

  it('EN: contains provider name', () => {
    const result = buildNextProviderNarration(NEXT_EN, 'en');
    expect(result).toContain("Bob's Plumbing");
  });

  it('EN: contains rating with stars', () => {
    const result = buildNextProviderNarration(NEXT_EN, 'en');
    expect(result).toContain('4.6');
    expect(result.toLowerCase()).toContain('star');
  });

  it('EN: contains distance formatted to 1 decimal', () => {
    const result = buildNextProviderNarration(NEXT_EN, 'en');
    expect(result).toContain('1.5');
    expect(result.toLowerCase()).toContain('km');
  });

  it('EN: distance formatted to exactly 1 decimal place', () => {
    const provider = { name: 'Test Co', rating: 4.0, distanceKm: 2.333 };
    const result = buildNextProviderNarration(provider, 'en');
    expect(result).toContain('2.3');
    expect(result).not.toContain('2.33');
  });

  it('FR: contains provider name', () => {
    const result = buildNextProviderNarration(NEXT_FR, 'fr');
    expect(result).toContain('PlombMax');
  });

  it('FR: contains distance formatted to 1 decimal', () => {
    const result = buildNextProviderNarration(NEXT_FR, 'fr');
    expect(result).toContain('3.0');
    expect(result.toLowerCase()).toContain('km');
  });

  it('FR: contains no-problem phrase', () => {
    const result = buildNextProviderNarration(NEXT_FR, 'fr');
    expect(result).toContain('Pas de probleme');
  });

  it('EN: no unresolved template literals', () => {
    const result = buildNextProviderNarration(NEXT_EN, 'en');
    expect(result).not.toMatch(/\$\{/);
  });
});

describe('buildNoResultsNarration', () => {
  it('EN: contains couldn\'t find language', () => {
    const result = buildNoResultsNarration('plumber', 'Austin', 'en');
    expect(result.toLowerCase()).toContain("couldn't find");
  });

  it('EN: contains service type and location', () => {
    const result = buildNoResultsNarration('plumber', 'Austin', 'en');
    expect(result).toContain('plumber');
    expect(result).toContain('Austin');
  });

  it('EN: suggests Google', () => {
    const result = buildNoResultsNarration('plumber', 'Austin', 'en');
    expect(result).toContain('Google');
  });

  it('FR: contains trouve phrase', () => {
    const result = buildNoResultsNarration('plombier', 'Montreal', 'fr');
    expect(result).toContain('trouve');
  });

  it('FR: contains service type and location', () => {
    const result = buildNoResultsNarration('plombier', 'Montreal', 'fr');
    expect(result).toContain('plombier');
    expect(result).toContain('Montreal');
  });

  it('FR: suggests Google', () => {
    const result = buildNoResultsNarration('plombier', 'Montreal', 'fr');
    expect(result).toContain('Google');
  });

  it('EN: no unresolved template literals', () => {
    const result = buildNoResultsNarration('plumber', 'Austin', 'en');
    expect(result).not.toMatch(/\$\{/);
  });
});

describe('buildSearchingFiller', () => {
  it('EN: contains Searching', () => {
    const result = buildSearchingFiller('plumber', 'Austin', 'en');
    expect(result).toContain('Searching');
  });

  it('EN: contains service type', () => {
    const result = buildSearchingFiller('plumber', 'Austin', 'en');
    expect(result).toContain('plumber');
  });

  it('EN: contains location', () => {
    const result = buildSearchingFiller('plumber', 'Austin', 'en');
    expect(result).toContain('Austin');
  });

  it('FR: contains cherche', () => {
    const result = buildSearchingFiller('plombier', 'Montreal', 'fr');
    expect(result).toContain('cherche');
  });

  it('FR: contains service type', () => {
    const result = buildSearchingFiller('plombier', 'Montreal', 'fr');
    expect(result).toContain('plombier');
  });

  it('FR: contains location', () => {
    const result = buildSearchingFiller('plombier', 'Montreal', 'fr');
    expect(result).toContain('Montreal');
  });

  it('EN: no unresolved template literals', () => {
    const result = buildSearchingFiller('plumber', 'Austin', 'en');
    expect(result).not.toMatch(/\$\{/);
  });
});
