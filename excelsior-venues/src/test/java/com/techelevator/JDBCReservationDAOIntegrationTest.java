package com.techelevator;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;


import javax.sql.DataSource;

import org.junit.After;
import org.junit.AfterClass;
import org.junit.Assert;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import com.techelevator.model.dao.jdbc.JDBCReservationDAO;
import com.techelevator.model.domain.Reservation;


public class JDBCReservationDAOIntegrationTest {
	
	private static SingleConnectionDataSource dataSource;
	private JDBCReservationDAO dao;
	private JdbcTemplate jdbcTemplate;
	
	LocalDate startDateString = LocalDate.parse("2020-06-22");
 	Date startDate = java.sql.Date.valueOf(startDateString);
 	
 	LocalDate testDateString = LocalDate.parse("2020-06-25");
 	Date testDate = java.sql.Date.valueOf(testDateString);
 	
 	LocalDate endDateString = LocalDate.parse("2020-06-24");
 	Date endDate = java.sql.Date.valueOf(endDateString);


	@BeforeClass
	public static void setupDataSource() {
		dataSource = new SingleConnectionDataSource();
		dataSource.setUrl("jdbc:postgresql://localhost:5432/excelsior-venues");
		dataSource.setUsername("postgres");
		dataSource.setPassword("postgres1");
		dataSource.setAutoCommit(false);
}

	
	@AfterClass
	public static void closeDataSource() throws SQLException {
		dataSource.destroy();
	}
	
	@Before
	public void preTest() {
		String sqlInsertReservation = "INSERT INTO reservation (reservation_id, space_id, number_of_attendees, start_date, end_date, reserved_for) VALUES (?, ?, ?, CAST(? AS DATE), CAST(? AS DATE), ?)";
		JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
		jdbcTemplate.update(sqlInsertReservation, 50, 1, 150, "2020-06-22", "2020-06-24", "Michael Tyson");
		dao = new JDBCReservationDAO(dataSource);
	}
	
	@After
	public void postTest() throws SQLException {
		dataSource.getConnection().rollback();
	}
	
	protected DataSource getDataSource() {
		return dataSource;
	}
	
	@Test
	public void testGetReservationAvailability() {
		List<Reservation> reservationList = new ArrayList<>();
		boolean reservationExists = false;
		reservationList = dao.getReservationAvailability("Hidden Owl Eatery", "2020-06-25", 2, 150);
		for (Reservation availableReservation : reservationList) {
			if (availableReservation.getVenueName().equals("Hidden Owl Eatery") ) {
				reservationExists = true;
			}
		}
		Assert.assertTrue(reservationExists);
	}
	
}