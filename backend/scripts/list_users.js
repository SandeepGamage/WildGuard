const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { User, Profile, Village } = require('../src/models/mongo/schemas');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({}).lean();
  const profiles = await Profile.find({}).lean();
  console.log('--- ALL USERS IN MONGODB (' + users.length + ') ---');
  users.forEach(u => console.log('ID: ' + u.id + ' | Email: ' + u.email + ' | Phone: ' + u.phone + ' | Role: ' + u.role + ' | Name: ' + u.full_name));
  console.log('\n--- ALL PROFILES (' + profiles.length + ') ---');
  profiles.forEach(p => console.log('ID: ' + p.id + ' | Name: ' + p.full_name + ' | Role: ' + p.role + ' | Phone: ' + p.phone + ' | Village: ' + p.registered_village_id));
  
  const villages = await Village.find({}).lean();
  console.log('\n--- ALL VILLAGES (' + villages.length + ') ---');
  villages.forEach(v => console.log('ID: ' + v.id + ' | Name: ' + v.name_en + ' | Lat/Lng: ' + v.latitude + ', ' + v.longitude));

  await mongoose.disconnect();
}
check().catch(console.error);
