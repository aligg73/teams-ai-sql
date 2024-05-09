import { TurnContext } from 'botbuilder';
import { Tokenizer } from '../tokenizers';
import { PromptResponse } from '../models';
import { Validation, PromptResponseValidator } from './PromptResponseValidator';
import { Memory } from '../MemoryFork';
import { Parser } from 'node-sql-parser'; // Import the parse function from the node-sql-parser package

/**
 * Interface for a function that executes SQL queries against the database.
 */
interface SQLQueryExecutor {
    (sqlQuery: string): Promise<any>; // Modify the return type as per your database response
}

interface QueryData {
    records: { "QUERY PLAN": string }[];
}

/**
 * Validates a SQL Query to ensure it has valid syntax and optionally executes an EXPLAIN query on the actual database.
 */
export class SQLQueryValidator<TValue = Record<string, any>>  implements PromptResponseValidator<TValue> {
    /**
     * Feedback message to display when the SQL response has invalid syntax.
     */
    public invalidSQLFeedback: string;
    public rowCountCeiling: number;

    /**
     * Function to execute SQL queries against the database.
     */
    private sqlQueryExecutor: SQLQueryExecutor;

    /**
     * Creates a new `SQLQueryValidator` instance.
     * @param {SQLQueryExecutor} sqlQueryExecutor Function to execute SQL queries against the database.
     * @param {string} invalidSQLFeedback Optional. Custom feedback message to display when the SQL response has invalid syntax.
     * Defaults to 'The provided SQL response has invalid syntax.'.
     */
    public constructor(
        sqlQueryExecutor: SQLQueryExecutor,
        invalidSQLFeedback: string = 'The provided SQL response has invalid syntax.',
        rowCountCeiling: number = 1500
    ) {
        this.sqlQueryExecutor = sqlQueryExecutor;
        this.invalidSQLFeedback = invalidSQLFeedback;
        this.rowCountCeiling = rowCountCeiling;
    }

    /**
     * Validates a SQL response.
     * @param {TurnContext} context Context for the current turn of conversation with the user.
     * @param {Memory} memory An interface for accessing state values.
     * @param {Tokenizer} tokenizer Tokenizer to use for encoding and decoding text.
     * @param {PromptResponse<string>} response Response to validate.
     * @param {number} remaining_attempts Number of remaining attempts to validate the response.
     * @returns {Promise<Validation>} A `Validation` object.
     */
    public async validateResponse(
        context: TurnContext,
        memory: Memory,
        tokenizer: Tokenizer,
        response: PromptResponse<string>,
        remaining_attempts: number
    ): Promise<Validation> {
        const message = response.message!;
        let sqlString = message.content ?? '';

        // sanitise the sqlString by removing any content before the first SELECT text
        // Find the position of the first occurrence of "SELECT"
        const selectIndex = sqlString.indexOf('SELECT');

        // If "SELECT" is found, extract the substring starting from that position
        if (selectIndex !== -1) {
            sqlString = sqlString.substring(selectIndex);
        }

        // Check if the SQL syntax is valid
        if (this.isValidSQL(sqlString)) {
            try {
                // Execute EXPLAIN query on the actual database
                const explanation = await this.sqlQueryExecutor(`EXPLAIN ${sqlString}`);
                const rowCount = this.extractRowsFromQueryPlan(explanation);

                if (rowCount && rowCount > this.rowCountCeiling) {
                    return {
                        type: 'Validation',
                        valid: false,
                        feedback: `The provided SQL generates too many rows: (${rowCount}). The maximum allowed is ${this.rowCountCeiling}. Adjust the query to LIMIT the results.`
                    };
                }

                return {
                    type: 'Validation',
                    valid: true,
                    value: sqlString
                };
            } catch (error) {
                return {
                    type: 'Validation',
                    valid: false,
                    feedback: (error as Error).message
                };
            }
        } else {
            return {
                type: 'Validation',
                valid: false,
                feedback: this.invalidSQLFeedback
            };
        }
    }

    /**
     * Checks if the provided SQL string has valid syntax.
     * @param {string} sqlString The SQL string to check.
     * @returns {boolean} True if the SQL syntax is valid, otherwise false.
     */
    private isValidSQL(sqlString: string): boolean {
        return true; // disabled because valid Postgres SQL queries like this one below are showing up as false negatives
        // SELECT ModifierGroups.title AS ModifierGroupTitle, string_agg(DISTINCT Items.title, ', ') AS ModifierOptions FROM ModifierGroups INNER JOIN Items_To_ModifierGroups ON ModifierGroups.id = Items_To_ModifierGroups.modifierGroupId INNER JOIN Items ON Items_To_ModifierGroups.itemId = Items.id LEFT JOIN ModifierGroups_To_Items ON ModifierGroups.id = ModifierGroups_To_Items.modifierGroupId LEFT JOIN Items AS ModifierItems ON ModifierGroups_To_Items.itemId = ModifierItems.id WHERE SOUNDEX(Items.title) = SOUNDEX('Bargain Bucket 6 Piece') GROUP BY ModifierGroupTitle;
        try {
            // Attempt to parse the SQL string
            const parser = new Parser();
            parser.astify(sqlString, { database: 'Postgresql' });
            return true; // The SQL syntax is valid
        } catch (error) {
            return false; // The SQL syntax is invalid
        }
    }

    private extractRowsFromQueryPlan(data: QueryData): number | null {
        try {
            if (!data || !data.records || !data.records.length) {
                return null; // Return null if data is empty or records array is missing or empty
            }
            
            const queryPlan = data.records[0]["QUERY PLAN"];
            const match = queryPlan.match(/rows=(\d+)/);
            const rows = match ? parseInt(match[1]) : null;
            
            return rows;
        } catch (error) {
            return null; // Return null if an error occurs
        }
    }
}
