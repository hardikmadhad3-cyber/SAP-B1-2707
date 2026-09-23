import { normalizeBusinessPartnerAddress, resolveBuyerBillToAddress } from './documentAddress';

describe('normalizeBusinessPartnerAddress', () => {
  test('normalizes SQL Server rows and supplies the selected customer code', () => {
    expect(normalizeBusinessPartnerAddress({
      Address: ' MAIN ',
      AdresType: 'B ',
      Street: 'Market Road',
      GSTRegnNo: '24ABCDE1234F1Z5',
    }, 'C0001')).toMatchObject({
      CardCode: 'C0001',
      Address: 'MAIN',
      AdresType: 'B',
      Street: 'Market Road',
      GSTIN: '24ABCDE1234F1Z5',
    });
  });

  test('normalizes uppercase HANA result keys', () => {
    expect(normalizeBusinessPartnerAddress({
      CARDCODE: 'C0002',
      ADDRESS: 'SHIPPING',
      ADRESTYPE: 'S',
      STREET: 'Second Street',
      STATE: 'GJ',
    })).toMatchObject({
      CardCode: 'C0002',
      Address: 'SHIPPING',
      AdresType: 'S',
      Street: 'Second Street',
      State: 'GJ',
    });
  });
});

describe('resolveBuyerBillToAddress', () => {
  const formatAddress = (address) => [address.Street, address.City].filter(Boolean).join(', ');

  test('uses the selected warehouse address for purchase documents', () => {
    expect(resolveBuyerBillToAddress({
      warehouse: { WhsCode: 'W1', Street: 'Plant Road', City: 'Ahmedabad' },
      companyAddress: { Address: 'Registered office' },
      formatAddress,
    })).toMatchObject({
      code: 'W1',
      address: 'Plant Road, Ahmedabad',
    });
  });

  test('falls back to the company address when warehouse address details are unavailable', () => {
    expect(resolveBuyerBillToAddress({
      warehouse: { WhsCode: 'W1' },
      companyAddress: { AddressName: 'HEAD OFFICE', Address: 'Registered office, Gujarat' },
      formatAddress,
    })).toMatchObject({
      code: 'HEAD OFFICE',
      address: 'Registered office, Gujarat',
    });
  });
});
