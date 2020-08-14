package com.techelevator.tenmo.dao;

import java.math.BigDecimal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.rowset.SqlRowSet;
import org.springframework.stereotype.Component;
import com.techelevator.tenmo.model.Account;

@Component
public class AccountSqlDAO implements AccountDAO {

	private JdbcTemplate jdbcTemplate;
	
	public AccountSqlDAO(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Override
	public Account findByUserId(Integer user_id) {
		String SqlStringFindByID = "SELECT * " +
						           "FROM accounts " +
						           "WHERE user_id = ?";
		SqlRowSet result = jdbcTemplate.queryForRowSet(SqlStringFindByID, user_id);
		result.next();
		Account account = mapRowToAccount(result);
		return account;
	}

	private Account mapRowToAccount(SqlRowSet result) {
		Account account = new Account();
		account.setAccount_id(result.getInt("account_id"));
		account.setUser_id(result.getInt("user_id"));
		account.setBalance(result.getBigDecimal("balance"));
		return account;
	}
	
	@Override
	public BigDecimal getBalanceByUserId(Integer user_id) {
		String SqlStringFindByID = "SELECT balance " +
		           "FROM accounts " +
		           "WHERE user_id = ?";
		SqlRowSet result = jdbcTemplate.queryForRowSet(SqlStringFindByID, user_id);
		result.next();
		return result.getBigDecimal("balance");
	}
	
	private BigDecimal getBalanceByAccountId(Integer account_id) {
		String SqlStringFindByID = "SELECT balance " +
		           "FROM accounts " +
		           "WHERE account_id = ?";
		SqlRowSet result = jdbcTemplate.queryForRowSet(SqlStringFindByID, account_id);
		result.next();
		return result.getBigDecimal("balance");
	}

	@Override
	public BigDecimal updateBalance(Integer account_id, BigDecimal deltaAmount) {
		BigDecimal newBalance = getBalanceByAccountId(account_id).add(deltaAmount);
		String SqlStringUpdateBalance = "UPDATE accounts SET balance = ? WHERE account_id = ?";
		jdbcTemplate.update(SqlStringUpdateBalance, newBalance, account_id);
		return getBalanceByAccountId(account_id);
	}

}
