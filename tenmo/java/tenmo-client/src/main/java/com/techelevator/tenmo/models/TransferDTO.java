package com.techelevator.tenmo.models;

import java.math.BigDecimal;

public class TransferDTO {

	private Integer transfer_id;
	private Integer transfer_type_id;
	private Integer transfer_status_id;
	private Integer account_from;
	private Integer account_to;
	private BigDecimal amount;
	
	
	public Integer getTransfer_id() {
		return transfer_id;
	}
	public void setTransfer_id(Integer transfer_id) {
		this.transfer_id = transfer_id;
	}
	public Integer getTransfer_type_id() {
		return transfer_type_id;
	}
	public void setTransfer_type_id(Integer transfer_type_id) {
		this.transfer_type_id = transfer_type_id;
	}
	public Integer getTransfer_status_id() {
		return transfer_status_id;
	}
	public void setTransfer_status_id(Integer transfer_status_id) {
		this.transfer_status_id = transfer_status_id;
	}
	public Integer getAccount_from() {
		return account_from;
	}
	public void setAccount_from(Integer account_from) {
		this.account_from = account_from;
	}
	public Integer getAccount_to() {
		return account_to;
	}
	public void setAccount_to(Integer account_to) {
		this.account_to = account_to;
	}
	public BigDecimal getAmount() {
		return amount;
	}
	public void setAmount(BigDecimal amount) {
		this.amount = amount;
	}
	
	
	
}
