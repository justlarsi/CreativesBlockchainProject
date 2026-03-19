export declare const CHAIN_ID_AMOY: number;

export interface AmoyAddressPayload {
  chainId: number;
  network: "amoy";
  deployedAt: string | null;
  contracts: {
    IPRegistry: string;
    LicenseAgreement: string;
    CollaborativeWork: string;
  };
}

export declare const AMOY_ADDRESSES: AmoyAddressPayload;
export declare const IPRegistryABI: readonly unknown[];
export declare const LicenseAgreementABI: readonly unknown[];
export declare const CollaborativeWorkABI: readonly unknown[];
