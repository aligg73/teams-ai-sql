import { strict as assert } from 'assert';
import { TestAdapter } from 'botbuilder';
import { TestTurnState } from '../internals/testing/TestTurnState';
import { GPTTokenizer } from '../tokenizers';
import { SQLQueryValidator } from './SQLQueryValidator';

describe('SQLQueryValidator', () => {
    const adapter = new TestAdapter();
    const tokenizer = new GPTTokenizer();

    describe('constructor', () => {
        it('should create a SQLQueryValidator with default parameters', () => {
            const validator = new SQLQueryValidator();
            assert.notEqual(validator, undefined);
        });

        it('should create a SQLQueryValidator with custom parameters', () => {
            const validator = new SQLQueryValidator('Custom feedback message', 10000);
            assert.notEqual(validator, undefined);
        });
    });

    describe('validateResponse', () => {
        it('should pass validation for a small SQL response', async () => {
            await adapter.sendTextToBot('test', async (context) => {
                const state = await TestTurnState.create(context);
                const validator = new SQLQueryValidator();
                const message = { role: 'assistant', content: 'Small SQL response' };

                const response = await validator.validateResponse(
                    context,
                    state,
                    tokenizer,
                    { status: 'success', message },
                    3
                );
                assert.notEqual(response, undefined);
                assert.equal(response.valid, true);
            });
        });

        it('should fail validation for a large SQL response', async () => {
            const largeSQLQuery = 'Very large SQL response'.repeat(10000);
            const message = { role: 'assistant', content: largeSQLQuery };

            await adapter.sendTextToBot('test', async (context) => {
                const state = await TestTurnState.create(context);
                const validator = new SQLQueryValidator();
                const response = await validator.validateResponse(
                    context,
                    state,
                    tokenizer,
                    { status: 'success', message },
                    3
                );
                assert.notEqual(response, undefined);
                assert.equal(response.valid, false);
            });
        });

        // Add more test cases as needed to cover various scenarios
    });
});
