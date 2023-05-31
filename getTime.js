/**
 * this script is used to know how much time is takes for dynamodb to return response
 */

const moment = require("moment");

exports.getTime = (current_date) => {
  const time = moment().diff(current_date);

  let time_presentation = "";
  const minutes = Math.floor(time / 60000).toString();
  if (minutes > 0) time_presentation = minutes + "mn ";

  const seconds = Math.floor((time - minutes * 60000) / 1000);
  time_presentation += seconds + "s ";

  const milliseconds = time - (minutes * 60000 + seconds * 1000);
  time_presentation += milliseconds + "ms";

  console.log("This operation takes: ", time_presentation);
};
