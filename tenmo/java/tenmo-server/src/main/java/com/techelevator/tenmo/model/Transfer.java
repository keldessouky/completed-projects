package com.techelevator.tenmo.model;

import java.math.BigDecimal;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Positive;

public class Transfer {

	private Integer transfer_id;
	
	@NotBlank (message = "Prodyct Type cannot be blank")
	private Integer transfer_type_id;
	@NotBlank (message = "Prodyct Status cannot be blank")
	private Integer transfer_status_id;
	@NotBlank (message = "Account To cannot be blank")
	private Integer account_from;
	@NotBlank (message = "Account From cannot be blank")
	private Integer account_to;
	@Positive( message= "Amount cannot be negative")
	@NotBlank (message = "Amount cannot be blank")
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
