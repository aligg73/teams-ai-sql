const { Parser } = require('node-sql-parser');
const parser = new Parser();

const opt = { database: 'Postgresql' };

// const ast = parser.astify(`SELECT ModifierGroups.title AS ModifierGroupTitle, string_agg(DISTINCT Items.title, ', ') AS ModifierOptions FROM ModifierGroups INNER JOIN Items_To_ModifierGroups ON ModifierGroups.id = Items_To_ModifierGroups.modifierGroupId INNER JOIN Items ON Items_To_ModifierGroups.itemId = Items.id LEFT JOIN ModifierGroups_To_Items ON ModifierGroups.id = ModifierGroups_To_Items.modifierGroupId LEFT JOIN Items AS ModifierItems ON ModifierGroups_To_Items.itemId = ModifierItems.id WHERE SOUNDEX(Items.title) = SOUNDEX('Bargain Bucket 6 Piece') GROUP BY ModifierGroupTitle;`, { database: 'Postgresql' });
// looks like DISTINCT is the issue: omitting it works:
const ast = parser.astify(`SELECT ModifierGroups.title AS ModifierGroupTitle, string_agg(Items.title, ', ') AS ModifierOptions FROM ModifierGroups INNER JOIN Items_To_ModifierGroups ON ModifierGroups.id = Items_To_ModifierGroups.modifierGroupId INNER JOIN Items ON Items_To_ModifierGroups.itemId = Items.id LEFT JOIN ModifierGroups_To_Items ON ModifierGroups.id = ModifierGroups_To_Items.modifierGroupId LEFT JOIN Items AS ModifierItems ON ModifierGroups_To_Items.itemId = ModifierItems.id WHERE SOUNDEX(Items.title) = SOUNDEX('Bargain Bucket 6 Piece') GROUP BY ModifierGroupTitle;`, { database: 'Postgresql' });
// const ast = parser.astify(`SELECT * FROM ModifierGroups INNER JOIN Items ON ModifierGroups.id = Items.id;`, { database: 'Postgresql' });
// const ast = parser.astify(`SELECT string_agg(DISTINCT title) FROM jobs;`, opt);

const exampleAst = `{
    "type": "select",
    "options": [
      "DISTINCT"
    ],
    "distinct": true,
    "columns": [
      {
        "expr": {
          "type": "column_ref",
          "table": "Categories",
          "column": "title"
        },
        "as": null
      }
    ],
    "from": [
      {
        "db": null,
        "table": "Stores",
        "as": null
      },
      {
        "db": null,
        "table": "StoreChannel_To_LatestMenu",
        "as": null,
        "join": {
          "type": "INNER",
          "on": {
            "type": "binary_expr",
            "operator": "=",
            "left": {
              "type": "column_ref",
              "table": "Stores",
              "column": "id"
            },
            "right": {
              "type": "column_ref",
              "table": "StoreChannel_To_LatestMenu",
              "column": "storeId"
            }
          }
        }
      },
      {
        "db": null,
        "table": "Menus",
        "as": null,
        "join": {
          "type": "INNER",
          "on": {
            "type": "binary_expr",
            "operator": "=",
            "left": {
              "type": "column_ref",
              "table": "StoreChannel_To_LatestMenu",
              "column": "latestMenuId"
            },
            "right": {
              "type": "column_ref",
              "table": "Menus",
              "column": "id"
            }
          }
        }
      },
      {
        "db": null,
        "table": "Menus_To_Dayparts",
        "as": null,
        "join": {
          "type": "INNER",
          "on": {
            "type": "binary_expr",
            "operator": "=",
            "left": {
              "type": "column_ref",
              "table": "Menus",
              "column": "id"
            },
            "right": {
              "type": "column_ref",
              "table": "Menus_To_Dayparts",
              "column": "menuId"
            }
          }
        }
      },
      {
        "db": null,
        "table": "Dayparts",
        "as": null,
        "join": {
          "type": "INNER",
          "on": {
            "type": "binary_expr",
            "operator": "=",
            "left": {
              "type": "column_ref",
              "table": "Menus_To_Dayparts",
              "column": "daypartId"
            },
            "right": {
              "type": "column_ref",
              "table": "Dayparts",
              "column": "id"
            }
          }
        }
      },
      {
        "db": null,
        "table": "Dayparts_To_Categories",
        "as": null,
        "join": {
          "type": "INNER",
          "on": {
            "type": "binary_expr",
            "operator": "=",
            "left": {
              "type": "column_ref",
              "table": "Dayparts",
              "column": "id"
            },
            "right": {
              "type": "column_ref",
              "table": "Dayparts_To_Categories",
              "column": "daypartId"
            }
          }
        }
      },
      {
        "db": null,
        "table": "Categories",
        "as": null,
        "join": {
          "type": "INNER",
          "on": {
            "type": "binary_expr",
            "operator": "=",
            "left": {
              "type": "column_ref",
              "table": "Dayparts_To_Categories",
              "column": "categoryId"
            },
            "right": {
              "type": "column_ref",
              "table": "Categories",
              "column": "id"
            }
          }
        }
      }
    ],
    "where": null,
    "groupby": null,
    "having": null,
    "orderby": null,
    "limit": null,
    "offset": null
  }
  `;

console.log(JSON.stringify(ast, null, 2));
const sql = parser.sqlify(exampleAst, opt);
// console.log(sql);
