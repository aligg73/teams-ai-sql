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
    records: { 'QUERY PLAN': string }[];
}

/**
 * Validates a SQL Query to ensure it has valid syntax and optionally executes an EXPLAIN query on the actual database.
 */
export class SQLQueryValidator<TValue = Record<string, any>> implements PromptResponseValidator<TValue> {
    /**
     * Feedback message to display when the SQL response has invalid syntax.
     */
    public invalidSQLFeedback: string;
    public rowCountCeiling: number;
    public allowedJoins: string[];

    /**
     * Function to execute SQL queries against the database.
     */
    private sqlQueryExecutor: SQLQueryExecutor;

    /**
     * Creates a new `SQLQueryValidator` instance.
     * @param {SQLQueryExecutor} sqlQueryExecutor Function to execute SQL queries against the database.
     * @param {string[]} allowedJoins Array to hold valid JOINs
     * @param {string} invalidSQLFeedback Optional. Custom feedback message to display when the SQL response has invalid syntax.
     * Defaults to 'The provided SQL response has invalid syntax.'.
     * @param {number} rowCountCeiling Number to indicate the threshold of records allowed
     */
    public constructor(
        sqlQueryExecutor: SQLQueryExecutor,
        allowedJoins: string[] = [],
        invalidSQLFeedback: string = 'The provided SQL response has invalid syntax.',
        rowCountCeiling: number = 1500
    ) {
        this.sqlQueryExecutor = sqlQueryExecutor;
        this.invalidSQLFeedback = invalidSQLFeedback;
        this.allowedJoins = allowedJoins;
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
        if (Object.keys(this.isValidSQL(sqlString)).length !== 0) {
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

                // check for valid JOINs
                const feedbackJoins = this.containsValidJoins(sqlString);
                if (feedbackJoins !== '')
                    return {
                        type: 'Validation',
                        valid: false,
                        feedback: feedbackJoins
                    };

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
    private isValidSQL(sqlString: string): object {
        // return true; // disabled because valid Postgres SQL queries like this one below are showing up as false negatives
        // SELECT ModifierGroups.title AS ModifierGroupTitle, string_agg(DISTINCT Items.title, ', ') AS ModifierOptions FROM ModifierGroups INNER JOIN Items_To_ModifierGroups ON ModifierGroups.id = Items_To_ModifierGroups.modifierGroupId INNER JOIN Items ON Items_To_ModifierGroups.itemId = Items.id LEFT JOIN ModifierGroups_To_Items ON ModifierGroups.id = ModifierGroups_To_Items.modifierGroupId LEFT JOIN Items AS ModifierItems ON ModifierGroups_To_Items.itemId = ModifierItems.id WHERE SOUNDEX(Items.title) = SOUNDEX('Bargain Bucket 6 Piece') GROUP BY ModifierGroupTitle;
        try {
            // Attempt to parse the SQL string
            const parser = new Parser();
            const parsedSql = parser.astify(sqlString, { database: 'Postgresql' });
            return parsedSql; // The SQL syntax is valid
        } catch (error) {
            return {}; // The SQL syntax is invalid
        }
    }

    /**
     * Validates the joins used in the sqlString against allowedJoins
     * @param {string} sqlString The SQL string to check.
     * @returns {string} A feedback message for the LLM to auto-correct
     */
    private containsValidJoins(sqlString: string): string {
        const innerJoins = [];
        const joinRegex = /INNER JOIN\s+\S+\s+ON\s+\S+\s*=\s*\S+/g;

        let match;
        while ((match = joinRegex.exec(sqlString)) !== null) {
            innerJoins.push(match[0]);
        }

        if (!innerJoins || innerJoins.length === 0) return ''; // No joins found in the example query
        // Check if each join in sqlString is allowed
        const disallowedJoins = [];
        for (const join of innerJoins) {
            if (!this.allowedJoins.includes(join)) {
                disallowedJoins.push(join);
            }
        }
        // Generate feedback message for disallowed joins
        let feedback = '';
        if (disallowedJoins.length > 0)
            feedback = 'The following joins are not correct, adhere to the SQL schema: ' + disallowedJoins.join('|');
        return feedback;
    }

    private extractRowsFromQueryPlan(data: QueryData): number | null {
        try {
            if (!data || !data.records || !data.records.length) {
                return null; // Return null if data is empty or records array is missing or empty
            }

            const queryPlan = data.records[0]['QUERY PLAN'];
            const match = queryPlan.match(/rows=(\d+)/);
            const rows = match ? parseInt(match[1]) : null;

            return rows;
        } catch (error) {
            return null; // Return null if an error occurs
        }
    }
}
