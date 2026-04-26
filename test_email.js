require("dotenv").config();
const { getTenantSmtpSettings } = require("./server/db");
const { sendEmail, sendEmailViaPostmanGpx } = require("./server/emailService");

async function test() {
  try {
    console.log("Testing email...");
    console.log(await getTenantSmtpSettings(1));
  } catch (e) {
    console.error(e);
  }
}
test();
