const AppSearchClient = require("@elastic/app-search-node");
require("dotenv").config({ path: __dirname.concat("/../.env") });
// initializing dynamodb client
var AWS = require("aws-sdk");

AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

var documentClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-10-08",
});

var { parse } = require("papaparse");
var fs = require("fs");

// initializing Search Engine client
const apiKey = process.env.API_KEY;
const base_url = process.env.BASE_URL;
const client = new AppSearchClient(undefined, apiKey, () => base_url);

const types = ["transaction", "beneficiary"];
const file = fs.readFileSync(__dirname + "/results.csv");
parse(file.toString(), {
  delimiter: ";",
  skipEmptyLines: true,
  header: true,
  complete: (result) => {
    update(result.data, ["transaction_status"], "transaction", true);
  },
});

async function update(data, attributes_to_update, type, doNotFetch = false) {
  if (!types.includes(type)) throw Error(`${type} not supported`);
  const engineName =
    type == "beneficiary"
      ? process.env.BENEFICIARIES_ENGINE
      : process.env.TRANSACTIONS_ENGINE;

  const primaryKey = ["bps_id", "donator_company_name"];
  const all_attribute = primaryKey.concat(attributes_to_update);
  var updatedData = [...data];
  try {
    updatedData = (
      await getEntities(
        updatedData.map((it) => {
          // check if the attribute holding the identifier is available
          const identifier =
            type == "beneficiary" ? "beneficiary_id" : "bps_id";
          if (!it[identifier]) throw Error(`Can't read ${att} attribute value`);
          it["bps_id"] = it[identifier];
          for (var key of primaryKey) {
            if (!it[key]) throw Error(`Can't read ${key} attribute value`);
          }
          return it;
        }),
        { attributes_to_update: all_attribute, type, doNotFetch }
      )
    ).map((item, index) => {
      const it = {};

      for (var att of attributes_to_update) {
        if (!data[index][att]) throw Error(`Can't read ${att} attribute value`);
        it[att] = parseInt(data[index][att]) || data[index][att];
      }
      for (var key of primaryKey) {
        if (!item[key]) throw Error(`Can't read ${key} attribute value`);
        it[key] = item[key];
      }
      return it;
    });
    console.log("entities to be updated: ", updatedData);
    console.log("start .....");
    for (var processor of [DynamodbUpdateEntities, ESUpdateEntities]) {
      console.log("processor: ", processor);
      console.log("updated attributes: ", updatedData);
      await processing_data([...updatedData], processor, {
        chunk_size: 100,
        attributes_to_update,
        engineName,
        type,
      });
    }
    console.log("end");
  } catch (error) {
    console.log("Error:", error);
  }
}

async function ESUpdateEntities(data, payload) {
  const { engineName, type } = payload;
  console.log("start updating appSearch data....");
  const mapped = [];
  console.log("getting entities IDs from the search engine....");
  for (var entity of [...data]) {
    const cloned = { ...entity };
    const { donator_company_name } = cloned;

    cloned.id = await getESDocId(engineName, cloned, type);
    cloned.donator_partition = donator_company_name;
    const partition = donator_company_name.match(
      new RegExp("@" + "(.*)" + "_")
    );
    if (partition) cloned.donator_company_name = partition[1];

    mapped.push(cloned);
  }
  console.log("entities IDs successfully fetched.");

  console.log("ES: mapped entities sample ->", mapped[0]);

  const result = await client.updateDocuments(engineName, mapped);
  console.log("update is completed with success: ", result);
}

async function getESDocId(engineName, doc, type) {
  return type == types[0]
    ? doc.bps_id
    : `${doc.bps_id}-${doc.donator_company_name}`;
}
async function DynamodbUpdateEntities(entities, { attributes_to_update }) {
  console.log("start updating dynamodb ....");
  // Create the DynamoDB service object

  var setUpdateExp = attributes_to_update.reduce(
    (p, c, index, arr) =>
      p + `${c} = :${c}` + (index == arr.length - 1 ? "" : " and "),
    "set "
  );
  for (var entity of entities) {
    const result = await new Promise((resolve, reject) => {
      const { donator_company_name, bps_id } = entity;

      var expAttributeVal = {};

      for (var att of attributes_to_update)
        expAttributeVal[`:${att}`] = entity[att];
      var params = {
        TableName: "bps_local",
        Key: {
          bps_id,
          donator_company_name,
        },
        UpdateExpression: setUpdateExp,
        ExpressionAttributeValues: expAttributeVal,
      };

      console.log("Updating entity params >>> ", params);
      documentClient.update(params, function (err, updatedData) {
        if (err) {
          if (err.code == "ConditionalCheckFailedException") reject(err);
          return;
        } else {
          console.log("Updated entity >>> ", updatedData);
          resolve(updatedData);
        }
      });
    });
    console.log("dynamodb result:", result);
  }
}

function processing_data(data, process, payload) {
  const { chunk_size } = payload;
  return new Promise(async (resolve) => {
    let chunk = 0;
    const size = chunk_size || 100;
    const length = data.length;
    console.debug(`processing ${length} entities`);
    while (chunk <= length) {
      const copy = [...data];
      let slice = copy.splice(chunk, size);
      await process(slice, payload);
      chunk += size;
    }
    resolve([]);
  });
}

async function getEntities(
  entities,
  { attributes_to_update, type, doNotFetch }
) {
  return new Promise(async (resolve, reject) => {
    console.log(`start getting ${entities.length} entities from dynamodb....`);

    if (doNotFetch) {
      return resolve(entities);
    }
    const fetchedEntities = [];
    for (var entity of entities) {
      const { bps_id, donator_company_name } = entity;

      var params = {
        TableName: "bps_local",
        KeyConditionExpression:
          "bps_id = :bps_id and begins_with(donator_company_name,:don)",
        ExpressionAttributeValues: {
          ":bps_id": bps_id,
          ":don": `${type}@${donator_company_name}`,
        },
        ProjectionExpression: attributes_to_update.join(", "),
      };

      console.log("getting entity params >>> ", params);
      try {
        const data = await documentClient.query(params).promise();

        console.log("Fetched entity ->", data.Items[0]);
        if (data && data.Items.length) fetchedEntities.push(data.Items[0]);
        else reject(Error("Entity Not found"));
      } catch (error) {
        console.error(`Error while getting entity bps_id: ${bps_id} ->`, error);
        reject(error);
        return;
      }
    }
    console.log(`${fetchedEntities.length} transactions have been fetched.`);
    resolve(fetchedEntities);
  });
}
