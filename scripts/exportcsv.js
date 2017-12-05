require('dotenv').config({ path: '../.env' });
const contentful = require('contentful-management');
const Promise = require('bluebird');
const get = require('lodash/get');
const fs = require('fs');
const csvExport = require('csv-export');

const client = contentful.createClient({
  accessToken: process.env.MANAGEMENT_TOKEN,
});

const exportContent = async () => {
  const exportSpace = await client.getSpace(process.env.EXPORT_SPACE);

  const query = {
    'content_type': process.argv[4],
  };

  try {
    const exportedItems = await exportSpace.getEntries(query).then(x => x.items);

    csvExport.export(exportedItems, (buffer) => {
      fs.writeFileSync('./data.zip', buffer);
    });

    return true;
  } catch (error) {
    console.log(error);
  }
}

exportContent();
