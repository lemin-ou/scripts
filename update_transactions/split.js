var { parse, unparse } = require("papaparse");
var fs = require("fs");
var { saveAs } = require("file-saver");
var fs = require("fs");
require("dotenv").config();

const file = fs.readFileSync(__dirname + "/results.csv");
parse(file.toString(), {
  delimiter: ";",
  skipEmptyLines: true,
  header: true,
  complete: (result) => {
    split(result.data);
  },
});

function split(data) {
  var beneficiary_full_name_error = data.filter(
    (it) => it.reason == "Le nom du bénéficiaire invalide"
  );
  var card_number_error = data.filter(
    (it) => it.reason == "La carte bancaire du bénéficiaire invalide"
  );

  const b1 = unparse(beneficiary_full_name_error, {
    delimiter: ";",
  });
  console.log("b1", b1);
  fs.writeFileSync("beneficiary_full_name_error.csv", b1);

  const b2 = unparse(card_number_error, {
    delimiter: ";",
  });
  fs.writeFileSync("card_number_error.csv", b2);
}
