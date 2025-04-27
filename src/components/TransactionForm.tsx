'use client';

import { useFieldArray } from 'react-hook-form';
import type { UseFormReturn, Path } from 'react-hook-form';
import type { FormValues } from '~/lib/schema';
import { Button } from '~/components/ui/button';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Calendar } from '~/components/ui/calendar';
import { CalendarIcon } from '@radix-ui/react-icons';
import { format } from 'date-fns';
import { cn } from '~/lib/utils';
import { ACCOUNT_LINES, DEPARTMENTS } from '~/lib/constants';
import Receipts from './Receipts';

interface TransactionFormProps {
  form: UseFormReturn<FormValues>;
  isEditing?: boolean;
  isLoadingReceipts?: boolean;
  onRemoveTransaction?: (index: number) => void;
  onDeleteReceipt?: (transactionId: number, receiptId: number) => Promise<void>;
}

export function TransactionForm({
  form,
  isEditing = true,
  isLoadingReceipts = false,
  onRemoveTransaction,
  onDeleteReceipt,
}: TransactionFormProps) {
  const { control } = form;

  // Get the useFieldArray methods from the form
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'transactions',
  });
  
  console.log('Transaction form fields count:', fields?.length);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center pb-4 border-b border-gray-700">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-100">Transactions</h2>
        {isEditing && (
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() =>
              append({
                date: new Date(),
                accountLine: ACCOUNT_LINES[0] ?? '',
                department: DEPARTMENTS[0] ?? '',
                placeVendor: '',
                createdAt: new Date(),
                updatedAt: new Date(),
                description: '',
                amount: 1,
                receipts: [],
                newFiles: [],
              })
            }
          >
            Add Transaction
          </Button>
        )}
      </div>

      {fields.map((fieldItem, index) => (
        <div
          key={fieldItem.id}
          className="relative bg-gray-800 text-gray-100 rounded-lg border border-gray-600 shadow-lg p-6 pt-12 mb-8 space-y-6 hover:border-gray-500 transition-colors"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name={`transactions.${index}.date`}
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-sm font-medium">Date of Transaction</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-gray-700 border-gray-600 hover:bg-blue-600/50 hover:border-blue-500",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={!isEditing}
                        >
                          {field.value ?
                            (() => {
                              // Format with UTC date components to avoid timezone issues
                              let dateToFormat: Date;

                              if (field.value instanceof Date) {
                                dateToFormat = field.value;
                              } else {
                                // Parse string to date
                                dateToFormat = new Date(String(field.value));
                              }

                              // Create a date object that won't shift due to timezone
                              const utcYear = dateToFormat.getUTCFullYear();
                              const utcMonth = dateToFormat.getUTCMonth();
                              const utcDay = dateToFormat.getUTCDate();

                              // Create a new date with these components at noon UTC
                              const stableDate = new Date(Date.UTC(utcYear, utcMonth, utcDay, 12, 0, 0));

                              return format(stableDate, "PPP");
                            })()
                            :
                            <span>Pick a date</span>
                          }
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          if (date) {
                            // Create a date in UTC to avoid timezone issues
                            // Extract UTC components from the selected date
                            const year = date.getUTCFullYear();
                            const month = date.getUTCMonth();
                            const day = date.getUTCDate();

                            // Create a new UTC date at noon
                            const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0));

                            console.log('Calendar date selected:', {
                              originalDate: date.toISOString(),
                              utcDate: utcDate.toISOString(),
                              year: year,
                              month: month + 1,
                              day: day
                            });

                            // Use the UTC date
                            field.onChange(utcDate);
                          } else {
                            field.onChange(null);
                          }
                        }}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`transactions.${index}.amount`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right bg-gray-700 border-gray-600 hover:border-gray-500 focus:border-gray-400 text-gray-100"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      disabled={!isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name={`transactions.${index}.accountLine`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Account Line</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="w-full bg-gray-800 border-gray-700 hover:border-blue-500 hover:bg-blue-600/20 text-gray-100">
                        <SelectValue placeholder="Select account line" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {ACCOUNT_LINES.map((acct) => (
                          <SelectItem key={acct} value={acct} className="text-gray-100 hover:bg-blue-600/50">
                            {acct}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`transactions.${index}.department`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Department</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="w-full bg-gray-800 border-gray-700 hover:border-gray-600 text-gray-100">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept} className="text-gray-100 hover:bg-gray-700">
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name={`transactions.${index}.placeVendor`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Place/Vendor</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={!isEditing} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`transactions.${index}.description`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-100">Description</FormLabel>
                  <FormControl>
                    <Input
                      className="bg-gray-800 border-gray-700 hover:border-gray-600 focus:border-gray-500 text-gray-100"
                      {...field}
                      disabled={!isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Receipts
            receipts={fieldItem.receipts?.filter((receipt): receipt is { id: number; name: string; fileType: string; base64Content: string; createdAt: Date; updatedAt: Date; } =>
              receipt !== null &&
              receipt !== undefined &&
              typeof receipt === 'object' &&
              'id' in receipt &&
              receipt.id !== undefined &&
              'name' in receipt &&
              'fileType' in receipt &&
              'base64Content' in receipt
            ) ?? []}
            transactionId={typeof fieldItem.id === 'number' ? fieldItem.id : Number(fieldItem.id)}
            control={control}
            fileFieldName={`transactions.${index}.newFiles` as Path<FormValues>}
            isEditing={isEditing}
            isLoading={isLoadingReceipts}
            onDeleteReceipt={(transactionId, receiptId) => {
              console.log('Delete receipt button clicked:', { transactionId, receiptId });
              if (typeof onDeleteReceipt === 'function') {
                onDeleteReceipt(transactionId, receiptId);
              } else {
                console.error('onDeleteReceipt is not a function');
              }
            }}
          />

          {isEditing && (
            <Button
              type="button"
              variant="outline"
              className="absolute top-2 right-4 text-destructive hover:text-white hover:bg-blue-600/90 transition-colors"
              onClick={() => {
                console.log('Remove button clicked for transaction index:', index);
                
                // First, capture the transaction ID if it exists
                const formValues = form.getValues();
                const transactions = formValues.transactions;
                
                if (transactions && index < transactions.length) {
                  const tx = transactions[index];
                  console.log('Transaction to remove:', tx);
                  
                  // If we have a parent handler, call it first to track deleted IDs
                  if (typeof onRemoveTransaction === 'function') {
                    onRemoveTransaction(index);
                  } else if (tx && 'id' in tx && tx.id && typeof tx.id === 'number' && tx.id > 0) {
                    // If we don't have a parent handler but there's an ID, alert the user
                    alert('This transaction will be marked for deletion when you save the form.');
                  }
                }
                
                // Always remove the field from the form regardless
                remove(index);
                console.log('Removed transaction at index:', index);
              }}
            >
              Remove
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
