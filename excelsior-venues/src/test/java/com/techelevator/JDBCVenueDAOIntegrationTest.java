package com.techelevator;

import java.sql.SQLException;
import java.util.ArrayList;
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

import com.techelevator.model.dao.jdbc.JDBCVenueDAO;
import com.techelevator.model.domain.Venue;


public class JDBCVenueDAOIntegrationTest {

	/*
	 * Using this particular implementation of DataSource so that every database
	 * interaction is part of the same database session and hence the same database
	 * transaction
	 */
	private static SingleConnectionDataSource dataSource;
	private JDBCVenueDAO dao;
	private JdbcTemplate jdbcTemplate;
	private static final String TEST_VENUE = "Ross Hall";
	private static final String TEST_CATEGORY_NAME = "2020";
	


	/*
	 * Before any tests are run, this method initializes the datasource for testing.
	 */
	@BeforeClass
	public static void setupDataSource() {
		dataSource = new SingleConnectionDataSource();
		dataSource.setUrl("jdbc:postgresql://localhost:5432/excelsior-venues");
		dataSource.setUsername("postgres");
		dataSource.setPassword("postgres1");
		/*
		 * The following line disables autocommit for connections returned by this
		 * DataSource. This allows us to rollback any changes after each test
		 */
		dataSource.setAutoCommit(false);
	}

	/*
	 * After all tests have finished running, this method will close the DataSource
	 */
	@AfterClass
	public static void closeDataSource() throws SQLException {
		dataSource.destroy();
	}

	
	@Before
	public void preTest() {
		String sqlInsertVenue = "INSERT INTO venue (id, name, city_id, description) VALUES (?, ?, ?, ?)";
		JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
		jdbcTemplate.update(sqlInsertVenue, 20, TEST_VENUE, 4, "A building that is a college dorm but looks like an asylum from the outside.");
		dao = new JDBCVenueDAO(dataSource);
		
		String sqlInsertCategory = "INSERT INTO category (id, name) VALUES (?, ?)";
		jdbcTemplate.update(sqlInsertCategory, 7, TEST_CATEGORY_NAME);
		String sqlInsertCategoryVenue = "INSERT INTO category_venue (venue_id, category_id) VALUES (20, 7)";
		jdbcTemplate.update(sqlInsertCategoryVenue);
	}
	
	/*
	 * After each test, we rollback any changes that were made to the database so
	 * that everything is clean for the next test
	 */
	@After
	public void postTest() throws SQLException {
		dataSource.getConnection().rollback();
	}

	/*
	 * This method provides access to the DataSource for subclasses so that they can
	 * instantiate a DAO for testing
	 */
	protected DataSource getDataSource() {
		return dataSource;
	}

	
	@Test
	public void testGetVenues() {
		List<Venue> venueList = new ArrayList<>();
		boolean venueExists = false;
		venueList = dao.getAllVenues();
		for(Venue venue : venueList) {
			if (venue.getName().equals(TEST_VENUE)) {
				venueExists = true;
			}
		}
		Assert.assertTrue(venueExists);
	}
	
	@Test
	public void testGetCategories() {
		List<String> categoryList = new ArrayList<>();
		boolean VenueExists = false;
		Venue venueName = new Venue();
		venueName.setName(TEST_VENUE);
		venueName.setCategoryName(TEST_CATEGORY_NAME);
		categoryList = dao.getCategories(venueName);
		for(String category : categoryList) {
			if (venueName.getCategoryName().equals(TEST_CATEGORY_NAME)) {
				VenueExists = true;
			}
		}
		Assert.assertTrue(VenueExists);
	}	
}