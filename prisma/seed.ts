import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Permissions ─────────────────────────────────────────────────────────────

const PERMISSIONS = [
  { name: 'VIEW_DASHBOARD',   description: 'View the dashboard' },
  { name: 'VIEW_APPLICANTS',  description: 'View applicants' },
  { name: 'CREATE_APPLICANT', description: 'Create applicants' },
  { name: 'UPDATE_APPLICANT', description: 'Update applicants' },
  { name: 'DELETE_APPLICANT', description: 'Delete applicants' },
  { name: 'VIEW_PERMITS',     description: 'View permits' },
  { name: 'CREATE_PERMIT',    description: 'Create permits' },
  { name: 'APPROVE_PERMIT',   description: 'Approve or reject permits' },
  { name: 'MANAGE_PRINT',     description: 'Manage print queue' },
  { name: 'MANAGE_RFID',      description: 'Manage RFID encoding' },
  { name: 'MANAGE_QC',        description: 'Manage quality control' },
  { name: 'VIEW_AUDIT_LOGS',  description: 'View audit logs' },
  { name: 'EXPORT_AUDIT',     description: 'Export audit logs to CSV' },
  { name: 'MANAGE_USERS',     description: 'Manage system users' },
  { name: 'MANAGE_SETTINGS',  description: 'Manage system settings' },
  { name: 'MANAGE_CENTRES',   description: 'Manage DVLA office hierarchy (HQ only)' },
  { name: 'UPLOAD_BIOMETRIC', description: 'Upload biometric photos' },
];

const ADMIN_PERMS      = PERMISSIONS.map(p => p.name);
const OPERATOR_PERMS   = [
  'VIEW_DASHBOARD', 'VIEW_APPLICANTS', 'CREATE_APPLICANT', 'UPDATE_APPLICANT',
  'VIEW_PERMITS', 'CREATE_PERMIT', 'APPROVE_PERMIT',
  'MANAGE_PRINT', 'MANAGE_RFID', 'MANAGE_QC',
  'VIEW_AUDIT_LOGS', 'UPLOAD_BIOMETRIC',
];
const SUPERVISOR_PERMS = [
  'VIEW_DASHBOARD', 'VIEW_APPLICANTS', 'VIEW_PERMITS', 'APPROVE_PERMIT',
  'VIEW_AUDIT_LOGS', 'MANAGE_QC',
];

// ─── Ghana DVLA Office Hierarchy ─────────────────────────────────────────────
// 16 regions (post-2019 creation of Savannah, North East, Oti, Western North, Bono East, Ahafo)
// Structure: 1 Head Office → 16 Regional Centres → District Offices

type RegionDef = {
  name: string;
  town: string;
  address: string;
  districts: { name: string; town: string; address: string }[];
};

const GHANA_REGIONS: RegionDef[] = [
  {
    name: 'Greater Accra Region', town: 'Accra',
    address: 'PMB, DVLA House, Abossey Okai Road, Accra',
    districts: [
      { name: 'Tema District Office',    town: 'Tema',    address: 'Community 1, Tema' },
      { name: 'Madina District Office',  town: 'Madina',  address: 'Madina Market Rd, Madina' },
      { name: 'Adabraka District Office',town: 'Adabraka',address: 'Adabraka Roundabout, Accra' },
    ],
  },
  {
    name: 'Ashanti Region', town: 'Kumasi',
    address: 'P.O. Box KS 1234, Adum, Kumasi',
    districts: [
      { name: 'Obuasi District Office',  town: 'Obuasi',  address: 'Main St, Obuasi' },
      { name: 'Ejisu District Office',   town: 'Ejisu',   address: 'Ejisu Junction, Kumasi' },
    ],
  },
  {
    name: 'Western Region', town: 'Takoradi',
    address: 'Market Circle, Takoradi',
    districts: [
      { name: 'Sekondi District Office', town: 'Sekondi', address: 'John Sarbah Rd, Sekondi' },
      { name: 'Tarkwa District Office',  town: 'Tarkwa',  address: 'Goldfields Ave, Tarkwa' },
    ],
  },
  {
    name: 'Western North Region', town: 'Sefwi Wiawso',
    address: 'DVLA Office, Main Road, Sefwi Wiawso',
    districts: [
      { name: 'Bibiani District Office', town: 'Bibiani', address: 'Bibiani Road, Bibiani' },
    ],
  },
  {
    name: 'Central Region', town: 'Cape Coast',
    address: 'Kotokuraba Road, Cape Coast',
    districts: [
      { name: 'Kasoa District Office',   town: 'Kasoa',   address: 'Kasoa Interchange, Kasoa' },
      { name: 'Winneba District Office', town: 'Winneba', address: 'University Ave, Winneba' },
    ],
  },
  {
    name: 'Eastern Region', town: 'Koforidua',
    address: 'Hospital Road, Koforidua',
    districts: [
      { name: 'Nkawkaw District Office', town: 'Nkawkaw', address: 'New Road, Nkawkaw' },
      { name: 'Akim Oda District Office',town: 'Akim Oda',address: 'Main Street, Akim Oda' },
    ],
  },
  {
    name: 'Volta Region', town: 'Ho',
    address: 'SSNIT Flats, Ho',
    districts: [
      { name: 'Hohoe District Office',   town: 'Hohoe',   address: 'Jasikan Road, Hohoe' },
      { name: 'Keta District Office',    town: 'Keta',    address: 'Beach Road, Keta' },
    ],
  },
  {
    name: 'Oti Region', town: 'Dambai',
    address: 'DVLA Office, Dambai',
    districts: [
      { name: 'Jasikan District Office', town: 'Jasikan', address: 'Jasikan Main Road' },
    ],
  },
  {
    name: 'Bono Region', town: 'Sunyani',
    address: 'Clocktower, Sunyani',
    districts: [
      { name: 'Berekum District Office', town: 'Berekum', address: 'Berekum Station Rd' },
      { name: 'Wenchi District Office',  town: 'Wenchi',  address: 'Wenchi Market Rd' },
    ],
  },
  {
    name: 'Bono East Region', town: 'Techiman',
    address: 'DVLA Office, Techiman',
    districts: [
      { name: 'Kintampo District Office',town: 'Kintampo',address: 'Kintampo Road' },
    ],
  },
  {
    name: 'Ahafo Region', town: 'Goaso',
    address: 'DVLA Office, Goaso',
    districts: [
      { name: 'Mim District Office',     town: 'Mim',     address: 'Mim Main Road' },
    ],
  },
  {
    name: 'Northern Region', town: 'Tamale',
    address: 'Salaga Road, Tamale',
    districts: [
      { name: 'Yendi District Office',   town: 'Yendi',   address: 'Yendi Main Road' },
      { name: 'Savelugu District Office',town: 'Savelugu',address: 'Savelugu Junction' },
    ],
  },
  {
    name: 'Savannah Region', town: 'Damongo',
    address: 'DVLA Office, Damongo',
    districts: [
      { name: 'Bole District Office',    town: 'Bole',    address: 'Bole Market Road' },
    ],
  },
  {
    name: 'North East Region', town: 'Nalerigu',
    address: 'DVLA Office, Nalerigu',
    districts: [
      { name: 'Gambaga District Office', town: 'Gambaga', address: 'Gambaga Main Road' },
    ],
  },
  {
    name: 'Upper East Region', town: 'Bolgatanga',
    address: 'Hospital Road, Bolgatanga',
    districts: [
      { name: 'Navrongo District Office',town: 'Navrongo',address: 'Navrongo Road' },
      { name: 'Bawku District Office',   town: 'Bawku',   address: 'Bawku Market Road' },
    ],
  },
  {
    name: 'Upper West Region', town: 'Wa',
    address: 'Wa Polytechnic Road, Wa',
    districts: [
      { name: 'Lawra District Office',   town: 'Lawra',   address: 'Lawra Road' },
      { name: 'Tumu District Office',    town: 'Tumu',    address: 'Tumu Main Road' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function refNum(type: 'IDP' | 'ICMV', n: number) {
  return `DVLA-${type}-2025-${String(n).padStart(5, '0')}`;
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding DVLA IDP database…');

  // ── Permissions ──
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({ where: { name: perm.name }, update: {}, create: perm });
  }
  const allPerms = await prisma.permission.findMany();
  const byName   = Object.fromEntries(allPerms.map(p => [p.name, p]));
  const connect  = (names: string[]) => names.map(n => ({ id: byName[n].id }));
  console.log(`  ✓ Permissions (${PERMISSIONS.length})`);

  // ── Roles ──
  const adminRole = await prisma.role.upsert({
    where:  { name: 'ADMINISTRATOR' },
    update: { permissions: { set: connect(ADMIN_PERMS) } },
    create: { name: 'ADMINISTRATOR', description: 'Full system access', isSystem: true, permissions: { connect: connect(ADMIN_PERMS) } },
  });
  const operatorRole = await prisma.role.upsert({
    where:  { name: 'OPERATOR' },
    update: { permissions: { set: connect(OPERATOR_PERMS) } },
    create: { name: 'OPERATOR', description: 'Day-to-day permit operations', isSystem: true, permissions: { connect: connect(OPERATOR_PERMS) } },
  });
  const supervisorRole = await prisma.role.upsert({
    where:  { name: 'SUPERVISOR' },
    update: { permissions: { set: connect(SUPERVISOR_PERMS) } },
    create: { name: 'SUPERVISOR', description: 'Permit approval and quality oversight', isSystem: true, permissions: { connect: connect(SUPERVISOR_PERMS) } },
  });
  console.log('  ✓ Roles (ADMINISTRATOR, OPERATOR, SUPERVISOR)');

  // ── Head Office ──
  const headOffice = await prisma.dvlaOffice.upsert({
    where:  { id: 'hq-dvla-ghana-accra' },
    update: {},
    create: {
      id: 'hq-dvla-ghana-accra',
      name: 'DVLA Head Office — Accra',
      type: 'HEAD_OFFICE',
      regionName: 'Greater Accra Region',
      town: 'Accra',
      address: 'PMB, DVLA House, Abossey Okai Road, Accra',
      phone: '+233 302 213 599',
      placeOfIssueLabel: 'DVLA — Accra (Head Office)',
      isActive: true,
    },
  });
  console.log('  ✓ Head Office seeded');

  // ── Regional Centres + District Offices ──
  let totalDistricts = 0;
  const regionalOffices: { id: string; name: string; region: RegionDef }[] = [];

  for (const region of GHANA_REGIONS) {
    const regionId = `regional-${region.town.toLowerCase().replace(/\s+/g, '-')}`;
    const regional = await prisma.dvlaOffice.upsert({
      where:  { id: regionId },
      update: {},
      create: {
        id: regionId,
        name: `DVLA Regional Centre — ${region.town}`,
        type: 'REGIONAL_CENTRE',
        regionName: region.name,
        town: region.town,
        address: region.address,
        placeOfIssueLabel: `DVLA — ${region.town}`,
        parentOfficeId: headOffice.id,
        isActive: true,
      },
    });
    regionalOffices.push({ id: regional.id, name: regional.name, region });

    for (const district of region.districts) {
      const districtId = `district-${district.town.toLowerCase().replace(/\s+/g, '-')}`;
      await prisma.dvlaOffice.upsert({
        where:  { id: districtId },
        update: {},
        create: {
          id: districtId,
          name: district.name,
          type: 'DISTRICT_OFFICE',
          regionName: region.name,
          town: district.town,
          address: district.address,
          placeOfIssueLabel: `DVLA — ${district.town}`,
          parentOfficeId: regional.id,
          isActive: true,
        },
      });
      totalDistricts++;
    }
  }
  console.log(`  ✓ Regional Centres (${GHANA_REGIONS.length}) + District Offices (${totalDistricts})`);

  // ── Admin users ── assigned to offices by tier
  const accraRegional = regionalOffices.find(o => o.region.town === 'Accra')!;
  const kumasiRegional = regionalOffices.find(o => o.region.town === 'Kumasi')!;

  const adminUser = await prisma.adminUser.upsert({
    where: { email: 'admin@dvla.gov.gh' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { officeId: headOffice.id, notificationEmail: 'paaekwaw@gmail.com' } as any,
    create: {
      email: 'admin@dvla.gov.gh', password: await bcrypt.hash('Admin@2025', 10),
      firstName: 'Kwame', lastName: 'Asante', dvlaRole: 'Administrator',
      roleId: adminRole.id, officeId: headOffice.id,
      notificationEmail: 'paaekwaw@gmail.com',
    },
  });
  const operatorUser = await prisma.adminUser.upsert({
    where: { email: 'operator@dvla.gov.gh' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { officeId: accraRegional.id, notificationEmail: 'paaekwaw@gmail.com' } as any,
    create: {
      email: 'operator@dvla.gov.gh', password: await bcrypt.hash('Operator@1', 10),
      firstName: 'Abena', lastName: 'Mensah', dvlaRole: 'Operator',
      roleId: operatorRole.id, officeId: accraRegional.id,
      notificationEmail: 'paaekwaw@gmail.com',
    },
  });
  await prisma.adminUser.upsert({
    where: { email: 'supervisor@dvla.gov.gh' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { officeId: kumasiRegional.id, notificationEmail: 'paaekwaw@gmail.com' } as any,
    create: {
      email: 'supervisor@dvla.gov.gh', password: await bcrypt.hash('Supervisor@1', 10),
      firstName: 'Kofi', lastName: 'Boateng', dvlaRole: 'Supervisor',
      roleId: supervisorRole.id, officeId: kumasiRegional.id,
      notificationEmail: 'paaekwaw@gmail.com',
    },
  });
  // Extra regional operator for Kumasi
  await prisma.adminUser.upsert({
    where: { email: 'operator.kumasi@dvla.gov.gh' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { officeId: kumasiRegional.id, notificationEmail: 'paaekwaw@gmail.com' } as any,
    create: {
      email: 'operator.kumasi@dvla.gov.gh', password: await bcrypt.hash('Kumasi@2025', 10),
      firstName: 'Yaa', lastName: 'Boateng', dvlaRole: 'Operator',
      roleId: operatorRole.id, officeId: kumasiRegional.id,
      notificationEmail: 'paaekwaw@gmail.com',
    },
  });
  console.log('  ✓ Users (admin@HQ / operator@Accra / supervisor@Kumasi / operator@Kumasi)');

  // ── System config ──
  const configs = [
    { key: 'printer_api_endpoint',    value: '',                     description: 'Matica P4000 printer API endpoint' },
    { key: 'printer_name',            value: 'Matica P4000',         description: 'Printer display name' },
    { key: 'issuing_authority',       value: 'DVLA Ghana',           description: 'Issuing authority name on permits' },
    { key: 'sla_days',                value: '5',                    description: 'SLA target days for permit processing' },
    { key: 'dvla_db_api_endpoint',    value: '',                     description: 'DVLA Central Database REST API URL' },
    { key: 'mfa_required',            value: 'false',                description: 'Require MFA for all administrators' },
    { key: 'session_timeout_minutes', value: '15',                   description: 'Session inactivity timeout in minutes' },
    { key: 'place_of_issue_options',  value: 'Accra,Kumasi,Takoradi,Tamale,Cape Coast,Sunyani,Ho,Koforidua,Bolgatanga,Wa,Dambai,Nalerigu,Damongo,Sefwi Wiawso,Goaso,Techiman', description: 'Comma-separated DVLA regional issuing offices' },
  ];
  for (const cfg of configs) {
    await prisma.systemConfig.upsert({ where: { key: cfg.key }, update: {}, create: cfg });
  }
  console.log('  ✓ System config (8 keys)');

  // ── Demo applicants ──
  const applicants = await Promise.all([
    prisma.applicant.upsert({ where: { nationalId: 'GHA-1001-2345' }, update: {}, create: {
      surname: 'ASANTE', otherNames: 'Kwame Boateng', placeOfBirth: 'Kumasi',
      dateOfBirth: isoDate(1985, 3, 12), homeAddress: '14 Independence Ave, Accra',
      nationalId: 'GHA-1001-2345', licenceNumber: 'GH-DL-001234',
    }}),
    prisma.applicant.upsert({ where: { nationalId: 'GHA-1002-6789' }, update: {}, create: {
      surname: 'MENSAH', otherNames: 'Abena Efua', placeOfBirth: 'Cape Coast',
      dateOfBirth: isoDate(1990, 7, 24), homeAddress: '7 Cantonments Road, Accra',
      nationalId: 'GHA-1002-6789', licenceNumber: 'GH-DL-005678',
    }}),
    prisma.applicant.upsert({ where: { nationalId: 'GHA-1003-1122' }, update: {}, create: {
      surname: 'OWUSU', otherNames: 'Yaw Darko', placeOfBirth: 'Accra',
      dateOfBirth: isoDate(1978, 11, 5), homeAddress: '23 Osu Oxford St, Accra',
      nationalId: 'GHA-1003-1122', licenceNumber: 'GH-DL-009012',
    }}),
    prisma.applicant.upsert({ where: { nationalId: 'GHA-1004-3344' }, update: {}, create: {
      surname: 'AMPONSAH', otherNames: 'Akosua Nyarko', placeOfBirth: 'Takoradi',
      dateOfBirth: isoDate(1995, 1, 30), homeAddress: '5 Sekondi Road, Takoradi',
      nationalId: 'GHA-1004-3344', licenceNumber: 'GH-DL-012345',
    }}),
    prisma.applicant.upsert({ where: { nationalId: 'GHA-1005-5566' }, update: {}, create: {
      surname: 'OSEI', otherNames: 'Nana Yaw', placeOfBirth: 'Sunyani',
      dateOfBirth: isoDate(1982, 6, 18), homeAddress: '9 Brong-Ahafo Rd, Sunyani',
      nationalId: 'GHA-1005-5566', licenceNumber: 'GH-DL-015678',
    }}),
    prisma.applicant.upsert({ where: { nationalId: 'GHA-1006-7788' }, update: {}, create: {
      surname: 'ADJEI', otherNames: 'Maame Serwaah', placeOfBirth: 'Ho',
      dateOfBirth: isoDate(1993, 9, 2), homeAddress: '3 Volta Region Ave, Ho',
      nationalId: 'GHA-1006-7788', licenceNumber: 'GH-DL-018901',
    }}),
  ]);
  console.log(`  ✓ Applicants (${applicants.length})`);

  // ── Demo permits (scoped to offices) ──
  const existingP1 = await prisma.permit.findUnique({ where: { referenceNumber: refNum('IDP', 1) } });
  const p1 = existingP1 ?? await prisma.permit.create({ data: {
    permitType: 'IDP', referenceNumber: refNum('IDP', 1),
    applicantId: applicants[0].id, operatorId: operatorUser.id,
    officeId: accraRegional.id,
    status: 'issued', placeOfIssue: 'DVLA — Accra Regional Centre', classOfLicence: 'B',
    dateOfIssue: isoDate(2025, 1, 15), dateOfExpiry: isoDate(2026, 1, 14),
    bookletNumber: 'BKL-2025-00001',
    mrzLine1: 'IDGHAASANTE<<KWAME<BOATENG<<<<<<<<<<<<<<<<<',
    mrzLine2: '001234<<5GHA8503124M2601149<<<<<<<<<<<<<<<2',
  }});

  const existingP2 = await prisma.permit.findUnique({ where: { referenceNumber: refNum('IDP', 2) } });
  const p2 = existingP2 ?? await prisma.permit.create({ data: {
    permitType: 'IDP', referenceNumber: refNum('IDP', 2),
    applicantId: applicants[1].id, operatorId: operatorUser.id,
    officeId: accraRegional.id,
    status: 'approved', placeOfIssue: 'DVLA — Accra Regional Centre', classOfLicence: 'B, C',
    dateOfIssue: isoDate(2025, 2, 20), dateOfExpiry: isoDate(2026, 2, 19),
    mrzLine1: 'IDGHAMENSAH<<ABENA<EFUA<<<<<<<<<<<<<<<<<<<<',
    mrzLine2: '005678<<5GHA9007244F2602199<<<<<<<<<<<<<<<4',
  }});

  if (!await prisma.permit.findUnique({ where: { referenceNumber: refNum('IDP', 3) } })) {
    await prisma.permit.create({ data: {
      permitType: 'IDP', referenceNumber: refNum('IDP', 3),
      applicantId: applicants[2].id, operatorId: operatorUser.id,
      officeId: accraRegional.id,
      status: 'submitted', placeOfIssue: 'DVLA — Accra Regional Centre', classOfLicence: 'A',
      dateOfIssue: isoDate(2025, 3, 1), dateOfExpiry: isoDate(2026, 2, 28),
    }});
  }

  if (!await prisma.permit.findUnique({ where: { referenceNumber: refNum('IDP', 4) } })) {
    await prisma.permit.create({ data: {
      permitType: 'IDP', referenceNumber: refNum('IDP', 4),
      applicantId: applicants[3].id, operatorId: operatorUser.id,
      officeId: accraRegional.id,
      status: 'rejected', placeOfIssue: 'DVLA — Accra Regional Centre', classOfLicence: 'B',
      dateOfIssue: isoDate(2025, 3, 5), dateOfExpiry: isoDate(2026, 3, 4),
      rejectionReason: 'Biometric photo does not meet ICAO standards — resubmit with neutral expression.',
    }});
  }

  const existingP5 = await prisma.permit.findUnique({ where: { referenceNumber: refNum('ICMV', 1) } });
  const p5 = existingP5 ?? await prisma.permit.create({ data: {
    permitType: 'ICMV', referenceNumber: refNum('ICMV', 1),
    applicantId: applicants[4].id, operatorId: operatorUser.id,
    officeId: kumasiRegional.id,
    status: 'issued', placeOfIssue: 'DVLA — Kumasi Regional Centre', bookletNumber: 'BKL-2025-00002',
    ownerSurname: 'OSEI', ownerOtherNames: 'Nana Yaw',
    ownerHomeAddress: '9 Brong-Ahafo Rd, Sunyani',
    classOfVehicle: 'Saloon', makerOfChassis: 'Toyota', typeOfChassis: 'Corolla',
    serialNumber: 'TYT-20-00456', engineNumber: 'ENG-4A-FE-2020', numberOfCylinders: '4',
    horsePower: '132', bodyShape: 'Sedan', bodyColour: 'Silver',
    numberOfSeats: '5', weightUnladen: '1280', weightLaden: '1680',
    identificationMark: 'GW-2345-22',
    mrzLine1: 'ICMVGHAOSEI<<NANA<YAW<<<<<<<<<<<<<<<<<<<<<<',
    mrzLine2: '015678<<5GHA8206184M0000000<<<<<<<<<<<<<<<6',
  }});

  if (!await prisma.permit.findUnique({ where: { referenceNumber: refNum('ICMV', 2) } })) {
    await prisma.permit.create({ data: {
      permitType: 'ICMV', referenceNumber: refNum('ICMV', 2),
      applicantId: applicants[5].id, operatorId: operatorUser.id,
      officeId: kumasiRegional.id,
      status: 'submitted', placeOfIssue: 'DVLA — Kumasi Regional Centre',
      ownerSurname: 'ADJEI', ownerOtherNames: 'Maame Serwaah',
      ownerHomeAddress: '3 Volta Region Ave, Ho',
      classOfVehicle: 'SUV', makerOfChassis: 'Hyundai', typeOfChassis: 'Tucson',
      serialNumber: 'HYU-22-00789', engineNumber: 'ENG-G4NA-2022', numberOfCylinders: '4',
      horsePower: '175', bodyShape: 'SUV', bodyColour: 'Black',
      numberOfSeats: '5', weightUnladen: '1560', weightLaden: '2060',
      identificationMark: 'VR-1122-22',
    }});
  }

  console.log('  ✓ Permits (4× IDP, 2× ICMV)');

  // ── Print jobs ──
  const existingJob1 = await prisma.printJob.findFirst({ where: { permitId: p1.id } });
  const job1 = existingJob1 ?? await prisma.printJob.create({ data: {
    permitId: p1.id, operatorId: operatorUser.id,
    status: 'complete', printerName: 'Matica P4000',
    startedAt: new Date('2025-01-15T09:00:00Z'),
    completedAt: new Date('2025-01-15T09:04:30Z'),
  }});

  const existingJob2 = await prisma.printJob.findFirst({ where: { permitId: p2.id } });
  const job2 = existingJob2 ?? await prisma.printJob.create({ data: {
    permitId: p2.id, operatorId: operatorUser.id,
    status: 'queued', printerName: 'Matica P4000',
  }});

  const existingJob5 = await prisma.printJob.findFirst({ where: { permitId: p5.id } });
  const job5 = existingJob5 ?? await prisma.printJob.create({ data: {
    permitId: p5.id, operatorId: operatorUser.id,
    status: 'complete', printerName: 'Matica P4000',
    startedAt: new Date('2025-02-10T10:15:00Z'),
    completedAt: new Date('2025-02-10T10:19:45Z'),
  }});

  console.log('  ✓ Print jobs (3)');

  // ── RFID encodings ──
  if (!await prisma.rfidEncoding.findFirst({ where: { permitId: p1.id } })) {
    await prisma.rfidEncoding.create({ data: {
      permitId: p1.id, printJobId: job1.id,
      status: 'encoded', chipSerialNumber: 'RFID-2025-001-A4F2',
      verificationResult: 'pass', verificationDetails: 'All ICAO DG1-DG15 groups verified.',
      encodedAt: new Date('2025-01-15T10:30:00Z'),
    }});
  }
  if (!await prisma.rfidEncoding.findFirst({ where: { permitId: p2.id } })) {
    await prisma.rfidEncoding.create({ data: { permitId: p2.id, printJobId: job2.id, status: 'pending' }});
  }
  if (!await prisma.rfidEncoding.findFirst({ where: { permitId: p5.id } })) {
    await prisma.rfidEncoding.create({ data: {
      permitId: p5.id, printJobId: job5.id,
      status: 'encoded', chipSerialNumber: 'RFID-2025-002-B7C9',
      verificationResult: 'pass', verificationDetails: 'All ICAO DG1-DG15 groups verified.',
      encodedAt: new Date('2025-02-10T11:00:00Z'),
    }});
  }
  console.log('  ✓ RFID encodings (3)');

  // ── QC results ──
  if (!await prisma.qcResult.findFirst({ where: { permitId: p1.id } })) {
    await prisma.qcResult.create({ data: {
      permitId: p1.id, printJobId: job1.id,
      result: 'pass', opticalInspectionScore: 96.5,
      mrzValidation: true, rfidValidation: true,
      inspectedById: adminUser.id,
      inspectedAt: new Date('2025-01-15T11:45:00Z'),
    }});
  }
  if (!await prisma.qcResult.findFirst({ where: { permitId: p2.id } })) {
    await prisma.qcResult.create({ data: { permitId: p2.id, printJobId: job2.id, result: 'pending' }});
  }
  if (!await prisma.qcResult.findFirst({ where: { permitId: p5.id } })) {
    await prisma.qcResult.create({ data: {
      permitId: p5.id, printJobId: job5.id,
      result: 'pass', opticalInspectionScore: 98.0,
      mrzValidation: true, rfidValidation: true,
      inspectedById: adminUser.id,
      inspectedAt: new Date('2025-02-10T12:30:00Z'),
    }});
  }
  console.log('  ✓ QC results (3)');

  // ── Audit log ──
  const auditCount = await prisma.auditLog.count();
  if (auditCount === 0) {
    const auditEntries = [
      { userId: adminUser.id,    operatorName: 'Kwame Asante',  action: 'USER_LOGIN',       outcome: 'success', details: 'Admin login from Accra HQ' },
      { userId: operatorUser.id, operatorName: 'Abena Mensah',  action: 'USER_LOGIN',       outcome: 'success', details: 'Operator login from Accra Regional Centre' },
      { userId: operatorUser.id, operatorName: 'Abena Mensah',  action: 'APPLICANT_CREATED',outcome: 'success', applicantRef: 'GHA-1001-2345', details: 'Registered applicant Kwame Asante' },
      { userId: operatorUser.id, operatorName: 'Abena Mensah',  action: 'PERMIT_CREATED',   outcome: 'success', applicantRef: refNum('IDP', 1), details: 'IDP permit created at Accra Regional Centre' },
      { userId: adminUser.id,    operatorName: 'Kwame Asante',  action: 'PERMIT_APPROVED',  outcome: 'success', applicantRef: refNum('IDP', 1), details: 'IDP permit approved' },
      { userId: operatorUser.id, operatorName: 'Abena Mensah',  action: 'PRINT_JOB_CREATED',outcome: 'success', applicantRef: refNum('IDP', 1), details: 'Print job queued for IDP-001' },
      { userId: operatorUser.id, operatorName: 'Abena Mensah',  action: 'PRINT_COMPLETE',   outcome: 'success', applicantRef: refNum('IDP', 1), details: 'Print completed — booklet BKL-2025-00001' },
      { userId: adminUser.id,    operatorName: 'Kwame Asante',  action: 'RFID_ENCODED',     outcome: 'success', applicantRef: refNum('IDP', 1), details: 'RFID chip RFID-2025-001-A4F2 encoded and verified' },
      { userId: adminUser.id,    operatorName: 'Kwame Asante',  action: 'QC_PASS',          outcome: 'success', applicantRef: refNum('IDP', 1), details: 'QC passed — optical score 96.5%' },
      { userId: operatorUser.id, operatorName: 'Abena Mensah',  action: 'PERMIT_REJECTED',  outcome: 'warning', applicantRef: refNum('IDP', 4), details: 'Rejected — biometric photo ICAO non-compliance' },
    ];
    for (const entry of auditEntries) {
      await prisma.auditLog.create({ data: { ...entry, ipAddress: '196.26.1.' + (100 + auditEntries.indexOf(entry)) } });
    }
    console.log('  ✓ Audit log (10 entries)');
  } else {
    console.log(`  ↷ Audit log skipped (${auditCount} existing entries)`);
  }

  console.log('\n✅ Seeding complete!\n');
  console.log('  Accounts:');
  console.log('    Admin      → nom r             / Admin@2025   [Head Office, Accra]');
  console.log('    Operator   → operator@dvla.gov.gh          / Operator@1   [Accra Regional Centre]');
  console.log('    Supervisor → supervisor@dvla.gov.gh        / Supervisor@1 [Kumasi Regional Centre]');
  console.log('    Operator2  → operator.kumasi@dvla.gov.gh   / Kumasi@2025  [Kumasi Regional Centre]');
  console.log('\n  DVLA Offices:');
  console.log(`    1 Head Office + ${GHANA_REGIONS.length} Regional Centres + ${totalDistricts} District Offices`);
  console.log('\n  Demo data:');
  console.log('    6 applicants, 6 permits (4 IDP + 2 ICMV), 3 print jobs');
  console.log('    3 RFID records, 3 QC results, 10 audit log entries');
}

main()
  .catch(e => { console.error(e); throw e; })
  .finally(() => prisma.$disconnect());
