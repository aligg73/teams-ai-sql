import { TurnContext } from 'botbuilder';
import { Tokenizer } from '../tokenizers';
import { PromptResponse } from '../models';
import { Validation, PromptResponseValidator } from './PromptResponseValidator';
import { Response } from './Response';
import { Memory } from '../MemoryFork';
import openaiTokenCounter from 'openai-gpt-token-counter';

/**
 * Validates a SQL response to ensure it stays under a certain threshold of LLM token size.
 */
export class SQLResponseValidator<TValue = string> implements PromptResponseValidator<TValue> {
    /**
     * Creates a new `SQLResponseValidator` instance.
     * @param {string} tooLargeFeedback Optional. Custom feedback message to display when the SQL response is too large. Defaults to 'The SQL response was too large to feed into a model context window, adjust the SQL to limit the results'.
     * @param {number} maxTokenCount Optional. Maximum allowed token count for the SQL response. Defaults to 7000.
     */
    public constructor(tooLargeFeedback: string = 'The SQL response was too large to feed into a model context window, adjust the SQL to limit the results', maxTokenCount: number = 7000) {
        this.tooLargeFeedback = tooLargeFeedback;
        this.maxTokenCount = maxTokenCount;
    }

    /**
     * Feedback message to display when the SQL response is too large.
     */
    public tooLargeFeedback: string;

    /**
     * Maximum allowed token count for the SQL response.
     */
    public maxTokenCount: number;

    /**
     * Validates a SQL response.
     * @param {TurnContext} context Context for the current turn of conversation with the user.
     * @param {Memory} memory An interface for accessing state values.
     * @param {Tokenizer} tokenizer Tokenizer to use for encoding and decoding text.
     * @param {PromptResponse<string>} response Response to validate.
     * @param {number} remaining_attempts Number of remaining attempts to validate the response.
     * @returns {Promise<Validation>} A `Validation` object.
     */
    public validateResponse(
        context: TurnContext,
        memory: Memory,
        tokenizer: Tokenizer,
        response: PromptResponse<string>,
        remaining_attempts: number
    ): Promise<Validation> {
        const message = response.message!;
        const text = message.content ?? '';

        // Parse the SQL response
        const parsedResults = Response.parseAllObjects(text);

        // Count the tokens in the parsed results
        const tokenCount = openaiTokenCounter.text(text, 'gpt-4');

        if (tokenCount > this.maxTokenCount) {
            return Promise.resolve({
                type: 'Validation',
                valid: false,
                feedback: this.tooLargeFeedback
            });
        } else {
            return Promise.resolve({
                type: 'Validation',
                valid: true,
                value: parsedResults
            });
        }
    }
}