require('dotenv').config() // configure env variables.
const ACCESS_KEY_ID = "ym8ymc"; // change it to your access key id
const SECRET_ACCESS_KEY = "nada"; // change it to your secret access key
const REGION = "localhost";
const ENDPOINT = "http://localhost:8000";
const ENVIRONMENT = "localhost";
const config = {
    region: process.env.REGION,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  }
  if(process.env.ENVIRONMENT == "localhost") config.endpoint = ENDPOINT;


module.exports = config
