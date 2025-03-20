'use client';

import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { FormValues } from '~/lib/schema';
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
  onRemoveTransaction?: (index: number) => void;
  onDeleteReceipt?: (transactionId: number, receiptId: number) => Promise<void>;
}

export function TransactionForm({
  form,
  isEditing = true,
  onRemoveTransaction,
  onDeleteReceipt,
}: TransactionFormProps) {
  const { control } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'transactions',
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Transactions</h2>
        {isEditing && (
          <Button
            type="button"
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
          className="border rounded p-4 mb-6 space-y-4"
        >
          <FormField
            control={control}
            name={`transactions.${index}.date`}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date of Transaction</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
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
            name={`transactions.${index}.accountLine`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Line</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account line" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_LINES.map((acct) => (
                        <SelectItem key={acct} value={acct}>
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
                <FormLabel>Department</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
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

          <FormField
            control={control}
            name={`transactions.${index}.placeVendor`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Place/Vendor</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`transactions.${index}.amount`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Receipts
            receipts={fieldItem.receipts}
            transactionId={fieldItem.id}
            control={control}
            fileFieldName={`transactions.${index}.newFiles`}
            isEditing={isEditing}
            onDeleteReceipt={onDeleteReceipt}
          />

          {isEditing && onRemoveTransaction && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onRemoveTransaction(index)}
            >
              Remove Transaction
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}