const { Parser } = require('node-sql-parser');
const parser = new Parser();

const ast = parser.astify(`SELECT ModifierGroups.title AS ModifierGroupTitle, string_agg(DISTINCT Items.title, ', ') AS ModifierOptions FROM ModifierGroups INNER JOIN Items_To_ModifierGroups ON ModifierGroups.id = Items_To_ModifierGroups.modifierGroupId INNER JOIN Items ON Items_To_ModifierGroups.itemId = Items.id LEFT JOIN ModifierGroups_To_Items ON ModifierGroups.id = ModifierGroups_To_Items.modifierGroupId LEFT JOIN Items AS ModifierItems ON ModifierGroups_To_Items.itemId = ModifierItems.id WHERE SOUNDEX(Items.title) = SOUNDEX('Bargain Bucket 6 Piece') GROUP BY ModifierGroupTitle;`, { database: 'Postgresql' });

console.log(ast);