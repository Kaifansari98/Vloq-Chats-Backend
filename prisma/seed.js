const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set in environment!");
  process.exit(1);
}

const pool = new Pool({ connectionString });

const dummyUsers = [
  { name: "John Doe", email: "john.doe@nexyn.com" },
  { name: "Jane Smith", email: "jane.smith@nexyn.com" },
  { name: "Alice Johnson", email: "alice.johnson@nexyn.com" },
  { name: "Bob Williams", email: "bob.williams@nexyn.com" },
  { name: "Charlie Brown", email: "charlie.brown@nexyn.com" },
  { name: "David Miller", email: "david.miller@nexyn.com" },
  { name: "Emily Davis", email: "emily.davis@nexyn.com" },
  { name: "Frank Wilson", email: "frank.wilson@nexyn.com" },
  { name: "Grace Taylor", email: "grace.taylor@nexyn.com" },
  { name: "Henry Anderson", email: "henry.anderson@nexyn.com" },
  { name: "Ivy Thomas", email: "ivy.thomas@nexyn.com" },
  { name: "Jack Jackson", email: "jack.jackson@nexyn.com" },
  { name: "Katherine White", email: "katherine.white@nexyn.com" },
  { name: "Liam Harris", email: "liam.harris@nexyn.com" },
  { name: "Mia Martin", email: "mia.martin@nexyn.com" },
  { name: "Noah Garcia", email: "noah.garcia@nexyn.com" },
  { name: "Olivia Martinez", email: "olivia.martinez@nexyn.com" },
  { name: "Peter Robinson", email: "peter.robinson@nexyn.com" },
  { name: "Quinn Clark", email: "quinn.clark@nexyn.com" },
  { name: "Ryan Rodriguez", email: "ryan.rodriguez@nexyn.com" },
  { name: "Sophia Lewis", email: "sophia.lewis@nexyn.com" },
  { name: "Thomas Lee", email: "thomas.lee@nexyn.com" },
  { name: "Ursula Walker", email: "ursula.walker@nexyn.com" },
  { name: "Victor Hall", email: "victor.hall@nexyn.com" },
  { name: "Wendy Allen", email: "wendy.allen@nexyn.com" },
  { name: "Xavier Young", email: "xavier.young@nexyn.com" },
  { name: "Yasmine Hernandez", email: "yasmine.hernandez@nexyn.com" },
  { name: "Zachary King", email: "zachary.king@nexyn.com" },
  { name: "Arjun Mehta", email: "arjun.mehta@nexyn.com" },
  { name: "Aisha Khan", email: "aisha.khan@nexyn.com" }
];

async function seed() {
  console.log("Starting database seed...");
  const client = await pool.connect();
  try {
    // 1. Begin transaction
    await client.query('BEGIN');

    // 0. Cleanup old butterfly organization if it exists (cascade will clean up associated users)
    console.log("Cleaning up old butterfly organization...");
    await client.query('DELETE FROM "OrganizationMaster" WHERE slug = $1', ['butterfly-ai']);

    // 2. Ensure UserTypeMaster records exist
    console.log("Checking UserTypeMaster records...");
    let adminType = await client.query('SELECT * FROM "UserTypeMaster" WHERE code = $1', ['ADMIN']);
    if (adminType.rows.length === 0) {
      console.log("Creating ADMIN UserTypeMaster...");
      adminType = await client.query(
        `INSERT INTO "UserTypeMaster" (uuid, name, code, "createdAt", "updatedAt") 
         VALUES (gen_random_uuid(), 'Admin', 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
         RETURNING *`
      );
    }
    const adminTypeId = adminType.rows[0].id;
    console.log(`ADMIN UserTypeMaster ID: ${adminTypeId}`);

    let memberType = await client.query('SELECT * FROM "UserTypeMaster" WHERE code = $1', ['MEMBER']);
    if (memberType.rows.length === 0) {
      console.log("Creating MEMBER UserTypeMaster...");
      memberType = await client.query(
        `INSERT INTO "UserTypeMaster" (uuid, name, code, "createdAt", "updatedAt") 
         VALUES (gen_random_uuid(), 'Member', 'MEMBER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
         RETURNING *`
      );
    }
    const memberTypeId = memberType.rows[0].id;
    console.log(`MEMBER UserTypeMaster ID: ${memberTypeId}`);

    // 3. Ensure default Organization exists
    console.log("Checking default organization...");
    const orgSlug = 'nexyn-chat';
    let org = await client.query('SELECT * FROM "OrganizationMaster" WHERE slug = $1', [orgSlug]);
    if (org.rows.length === 0) {
      console.log("Creating default organization (Nexyn Chat)...");
      org = await client.query(
        `INSERT INTO "OrganizationMaster" (uuid, name, slug, email, status, "isActive", "createdAt", "updatedAt") 
         VALUES (gen_random_uuid(), 'Nexyn Chat', $1, 'info@nexyn.com', 'ACTIVE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
         RETURNING *`,
        [orgSlug]
      );
    }
    const organizationId = org.rows[0].id;
    console.log(`Organization ID: ${organizationId}`);

    // 4. Ensure default Admin user exists
    console.log("Checking default Admin user...");
    const adminEmail = 'admin@nexyn.com';
    const adminPassword = 'AdminPassword@123';
    let adminUser = await client.query('SELECT * FROM "UserMaster" WHERE email = $1 AND "organizationId" = $2', [adminEmail, organizationId]);
    if (adminUser.rows.length === 0) {
      console.log(`Creating Admin User: ${adminEmail}...`);
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      adminUser = await client.query(
        `INSERT INTO "UserMaster" (
          uuid, name, email, password, "isActive", "profile_pic", "organizationId", "userTypeId", "createdAt", "updatedAt"
         ) 
         VALUES (gen_random_uuid(), 'Admin User', $1, $2, true, 'https://randomuser.me/api/portraits/men/33.jpg', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
         RETURNING *`,
        [adminEmail, passwordHash, organizationId, adminTypeId]
      );
      
      // Also insert into UserAuthProvider if required (e.g. provider = EMAIL)
      console.log("Creating local email auth provider for Admin...");
      await client.query(
        `INSERT INTO "UserAuthProvider" (uuid, "userId", provider, "providerId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'EMAIL', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [adminUser.rows[0].id, adminEmail]
      );
    } else {
      console.log("Admin User already exists.");
    }

    // 5. Ensure 30 realistic dummy users exist
    console.log("Seeding 30 realistic dummy users...");
    const dummyPasswordHash = await bcrypt.hash('root', 10);
    const femaleNames = [
      'jane', 'alice', 'emily', 'grace', 'ivy', 'katherine', 'mia', 'olivia', 
      'sophia', 'yasmine', 'aisha', 'wendy', 'katherine white', 'mia martin', 
      'olivia martinez', 'sophia lewis', 'wendy allen', 'yasmine hernandez', 'aisha khan'
    ];

    const maleAvatars = [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1500048993953-d23a436266cf?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1547037579-f0fc020ac3be?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1549068106-b024baf5062d?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1520156473399-0002824747a7?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1511551203524-9a24350a5e83?auto=format&fit=crop&w=150&h=150&q=80"
    ];

    const femaleAvatars = [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1506919258185-6078bba55d2a?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&w=150&h=150&q=80",
      "https://images.unsplash.com/photo-1594744803329-e58b31de215f?auto=format&fit=crop&w=150&h=150&q=80"
    ];

    let maleCount = 0;
    let femaleCount = 0;

    for (let i = 0; i < dummyUsers.length; i++) {
      const u = dummyUsers[i];
      let existingUser = await client.query('SELECT * FROM "UserMaster" WHERE email = $1 AND "organizationId" = $2', [u.email, organizationId]);
      if (existingUser.rows.length === 0) {
        console.log(`Creating dummy user: ${u.name} (${u.email})...`);
        const nameLower = u.name.toLowerCase();
        let avatarUrl = "";
        const isFemale = femaleNames.some(femaleName => nameLower.includes(femaleName));
        if (isFemale) {
          const index = femaleCount % femaleAvatars.length;
          avatarUrl = femaleAvatars[index];
          femaleCount++;
        } else {
          const index = maleCount % maleAvatars.length;
          avatarUrl = maleAvatars[index];
          maleCount++;
        }

        const userResult = await client.query(
          `INSERT INTO "UserMaster" (
            uuid, name, email, password, "isActive", "profile_pic", "organizationId", "userTypeId", "createdAt", "updatedAt"
           ) 
           VALUES (gen_random_uuid(), $1, $2, $3, true, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
           RETURNING *`,
          [u.name, u.email, dummyPasswordHash, avatarUrl, organizationId, memberTypeId]
        );
        
        await client.query(
          `INSERT INTO "UserAuthProvider" (uuid, "userId", provider, "providerId", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, 'EMAIL', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [userResult.rows[0].id, u.email]
        );
      }
    }

    // 6. Commit transaction
    await client.query('COMMIT');
    console.log("Database seeded successfully with admin and 30 dummy users!");
    console.log("==========================================");
    console.log("Admin credentials:");
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log("------------------------------------------");
    console.log("30 Dummy Users seeded!");
    console.log("  Password for all dummy users: root");
    console.log("  Example emails: john.doe@nexyn.com, jane.smith@nexyn.com, arjun.mehta@nexyn.com");
    console.log("==========================================");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error during database seed, transaction rolled back:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
