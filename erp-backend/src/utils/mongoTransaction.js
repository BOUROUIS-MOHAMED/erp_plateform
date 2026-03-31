const mongoose = require('mongoose');

let transactionSupportCache;

const supportsTransactions = async () => {
  if (!mongoose.connection?.db) {
    return false;
  }

  if (transactionSupportCache !== undefined) {
    return transactionSupportCache;
  }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupportCache = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch (error) {
    transactionSupportCache = false;
  }

  return transactionSupportCache;
};

const startOptionalSession = async () => {
  if (!(await supportsTransactions())) {
    return null;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  return session;
};

const withOptionalSession = (query, session) => (session ? query.session(session) : query);

const getSessionOptions = (session, options = {}) => (session ? { ...options, session } : options);

const commitOptionalTransaction = async (session) => {
  if (session) {
    await session.commitTransaction();
  }
};

const abortOptionalTransaction = async (session) => {
  if (session) {
    await session.abortTransaction();
  }
};

const endOptionalSession = (session) => {
  if (session) {
    session.endSession();
  }
};

module.exports = {
  abortOptionalTransaction,
  commitOptionalTransaction,
  endOptionalSession,
  getSessionOptions,
  startOptionalSession,
  withOptionalSession,
};
