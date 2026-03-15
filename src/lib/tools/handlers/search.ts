interface SearchProvidersParams {
  service_type: string;
  location: string;
  urgency?: string;
}

interface Provider {
  name: string;
  phone: string;
  rating: number;
  distance: string;
}

interface SearchProvidersResult {
  providers: Provider[];
  source: string;
  note: string;
}

export async function searchProviders(params: SearchProvidersParams): Promise<SearchProvidersResult> {
  console.log(`[tools:search] STUB — searchProviders("${params.service_type}", "${params.location}")`);

  return {
    providers: [
      {
        name: 'Stub Provider',
        phone: '+15550000000',
        rating: 4.5,
        distance: '2.3 mi',
      },
    ],
    source: 'stub',
    note: 'Real implementation in Phase 3',
  };
}
