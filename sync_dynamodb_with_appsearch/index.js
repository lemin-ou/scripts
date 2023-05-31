/**
 * this script feeds the bps documents(doing a restore) to Elastic Open Search
 */

// imports
const AppSearchClient = require("@elastic/app-search-node");
const fs = require("fs");
const path = require("path");
const TABLE_NAME = "bps_local";
require("dotenv").config({ path: __dirname.concat("/../.env") }); // parse env variables

try {
  const BACKUP_DIRECTORY = path.join(
    __dirname,
    "..",
    "backup",
    process.env.ENVIRONMENT,
    TABLE_NAME
  );
  for (let file of fs.readdirSync(BACKUP_DIRECTORY)) {
    // ------------------------------------
    console.debug(`reading backup data from file ${file}...`);
    // TODO: each time you need to backup,
    // you have to change the files exported from s3 as they won't be in the form of JSON array
    const backup = JSON.parse(
      fs.readFileSync(path.join(BACKUP_DIRECTORY, file))
    );
    console.debug("sending documents ...");
    insert_ben_trans(backup);
  }
} catch (error) {
  console.error("Error occur >>>", error);
}

function mapTrans(data) {
  return data
    .filter(({ Item }) => Item.donator_company_name.S.startsWith("transaction"))
    .map(({ Item }) => {
      const result = {};
      result.id = Item.bps_id.S; // index the documents using this value
      Object.keys(Item).forEach(
        (key) => (result[key] = Item[key].S || Item[key].N || Item[key].SS)
      );
      result.donator_partition = Item.donator_company_name.S;
      const partition = result.donator_partition.split("@")[1].split("_");
      result.donator_company_name = partition
        .splice(0, partition.length - 1)
        .join("_");
      return result;
    });
}
function mapBens(data) {
  return data
    .filter(({ Item }) => Item.donator_company_name.S.startsWith("beneficiary"))
    .map(({ Item }) => {
      const result = {};
      Object.keys(Item).forEach(
        (key) => (result[key] = Item[key].S || Item[key].N)
      );
      result.donator_partition = Item.donator_company_name.S;
      const partition = result.donator_partition.split("@")[1].split("_");
      result.donator_company_name = partition
        .splice(0, partition.length - 1)
        .join("_");
      result.id = `${Item.bps_id.S}-${result.donator_company_name}`; // index the documents using this value

      return result;
    });
}
async function insert_ben_trans(backup) {
  const apiKey = process.env.API_KEY;
  const base_url = process.env.BASE_URL;
  const client = new AppSearchClient(undefined, apiKey, () => base_url);
  const entities = [
    { engineName: "bea-prod-transactions-2", map: mapTrans },
    { engineName: "bea-prod-beneficiaries-2", map: mapBens },
  ];

  for (var entity of entities) {
    console.log("grouping", entity.engineName, "...");
    let entity_data = entity.map(backup);
    console.log("data", entity_data.length);
    console.log("sample", entity_data[0]);
    entity_data.length &&
      processing_data(
        entity_data,
        async (data) => await client.indexDocuments(entity.engineName, data)
      );
  }
}
async function processing_data(data, process, chunk_size) {
  return new Promise(async (resolve) => {
    let chunk = 0;
    const size = chunk_size || 100;
    const length = data.length;
    console.debug(`processing ${length} entities`);
    while (chunk <= length) {
      const copy = [...data];
      let slice = copy.splice(chunk, size);
      // console.debug("mapping sample >>>", slice[0])
      const result = await process(slice);
      console.debug(
        `${result.length} has been indexed from [${chunk}, ${chunk + size}]`,
        result
      );
      chunk += size;
    }
    resolve([]);
  });
}
