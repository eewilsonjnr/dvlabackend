export declare function generateRef(type: 'IDP' | 'ICMV'): string;
export declare function generateMRZ(surname: string, otherNames: string, dateOfBirth: string, dateOfExpiry: string, licenceNumber: string): {
    line1: string;
    line2: string;
};
export declare function generateContractNumber(prefix?: string): string;
//# sourceMappingURL=helpers.d.ts.map