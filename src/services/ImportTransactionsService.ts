import { getCustomRepository, getRepository, In } from 'typeorm';

import fs from 'fs';
import csvParse from 'csv-parse';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filepath: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoriesRepository = getRepository(Category);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    const contactsReadStream = fs.createReadStream(filepath);

    const parsers = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
      delimiter: ',',
    });

    const parseCSV = contactsReadStream.pipe(parsers);

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const existingCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existingCategoriesTitle = existingCategories.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !existingCategoriesTitle.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existingCategories];

    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionRepository.save(createdTransactions);

    await fs.promises.unlink(filepath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
