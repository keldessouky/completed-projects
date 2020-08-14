package com.techelevator.tenmo.dao;

import java.math.BigDecimal;

import com.techelevator.tenmo.model.Account;

public interface AccountDAO {

	Account findByUserId(Integer user_id);
	
	BigDecimal getBalanceByUserId(Integer user_id);
	
	BigDecimal updateBalance(Integer user_id, BigDecimal deltaAmount);
	
}
