import { TurnContext } from 'botbuilder';
import { Tokenizer } from '../tokenizers';
import { PromptResponse } from '../models';
import { Validation, PromptResponseValidator } from './PromptResponseValidator';
import { Memory } from '../MemoryFork';
import { Parser } from 'node-sql-parser'; // Import the parse function from the node-sql-parser package

/**
 * Validates a SQL response to ensure it has valid syntax.
 */
export class SQLResponseValidator<TValue = string> implements PromptResponseValidator<TValue> {
    /**
     * Feedback message to display when the SQL response has invalid syntax.
     */
    public invalidSQLFeedback: string;

    /**
     * Creates a new `SQLResponseValidator` instance.
     * @param {string} invalidSQLFeedback Optional. Custom feedback message to display when the SQL response has invalid syntax.
     * Defaults to 'The provided SQL response has invalid syntax.'.
     */
    public constructor(invalidSQLFeedback: string = 'The provided SQL response has invalid syntax.') {
        this.invalidSQLFeedback = invalidSQLFeedback;
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
        const sqlString = message.content ?? '';

        // Check if the SQL syntax is valid
        if (this.isValidSQL(sqlString)) {
            return {
                type: 'Validation',
                valid: true,
                value: sqlString
            };
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
        try {
            // Attempt to parse the SQL string
            const parser = new Parser();
            parser.astify(sqlString);
            return true; // The SQL syntax is valid
        } catch (error) {
            return false; // The SQL syntax is invalid
        }
    }
}
