'use server';
/**
 * @fileOverview This file implements a Genkit flow for suggesting professional invoice item descriptions.
 *
 * - suggestInvoiceItemDescriptions - A function that handles the generation of invoice item description suggestions.
 * - SuggestInvoiceItemDescriptionInput - The input type for the suggestInvoiceItemDescriptions function.
 * - SuggestInvoiceItemDescriptionOutput - The return type for the suggestInvoiceItemDescriptions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestInvoiceItemDescriptionInputSchema = z.object({
  itemName: z.string().describe('A short input describing the invoice item.'),
});
export type SuggestInvoiceItemDescriptionInput = z.infer<
  typeof SuggestInvoiceItemDescriptionInputSchema
>;

const SuggestInvoiceItemDescriptionOutputSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe('An array of professional invoice item description suggestions.'),
});
export type SuggestInvoiceItemDescriptionOutput = z.infer<
  typeof SuggestInvoiceItemDescriptionOutputSchema
>;

export async function suggestInvoiceItemDescriptions(
  input: SuggestInvoiceItemDescriptionInput
): Promise<SuggestInvoiceItemDescriptionOutput> {
  return suggestInvoiceItemDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'invoiceItemDescriptionPrompt',
  input: {schema: SuggestInvoiceItemDescriptionInputSchema},
  output: {schema: SuggestInvoiceItemDescriptionOutputSchema},
  prompt: `You are an AI assistant specialized in creating professional and concise invoice item descriptions.

Generate 3-5 professional and varied invoice item descriptions based on the following input, ensuring they are suitable for a business invoice.

Input: "{{{itemName}}}"`,
});

const suggestInvoiceItemDescriptionFlow = ai.defineFlow(
  {
    name: 'suggestInvoiceItemDescriptionFlow',
    inputSchema: SuggestInvoiceItemDescriptionInputSchema,
    outputSchema: SuggestInvoiceItemDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
