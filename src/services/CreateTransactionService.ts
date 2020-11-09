import { getCustomRepository, getRepository } from 'typeorm';

import Category from '../models/Category';

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

import AppError from '../errors/AppError';

interface Request {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    const { total } = transactionsRepository.getBalance();

    if (type === 'outcome' && total < value) {
      throw new AppError('You do not have enough balance');
    }

    let transactionCategory = await categoryRepository.findOne({
      where: {
        title: category,
      },
    });

    if (!transactionCategory) {
      transactionCategory = categoryRepository.create({
        title: category,
      });

      await categoryRepository.save(transactionCategory);
    }

    if (!['income', 'outcome'].includes(type)) {
      throw new Error('Transaction type is invalid');
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: transactionCategory,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
